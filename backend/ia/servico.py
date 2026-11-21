"""
Serviço do modelo de linguagem local da Afinidade por IA.

- Modelo: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384 dimensões, multilíngue),
  executado pelo fastembed (ONNX Runtime, sem PyTorch). Tudo roda no servidor: nenhum texto é enviado
  para serviços externos. A internet só é usada para BAIXAR o modelo (uma vez, `baixar_modelo_ia`).
- O modelo é carregado uma única vez por processo, sob demanda e com trava (thread-safe).
- Se a carga falhar (sem internet na primeira vez, arquivo corrompido...), o erro vai para o logger,
  o serviço fica "indisponível" e o sistema segue com os 6 critérios. Uma nova tentativa só acontece
  depois de NOVA_TENTATIVA_S segundos (ou com `baixar_modelo_ia`).
- Configuração: IA_HABILITADA, IA_MODELO_DIR e IA_EMBEDDER ('fastembed' ou 'falso', só para testes).
"""

from __future__ import annotations

import glob
import hashlib
import logging
import os
import re
import threading
import time
import unicodedata

import numpy as np
from django.conf import settings

from matches.algoritmo.config import LIMIAR_TEMA, MARGEM_TEMA, MAX_TEMAS, MIN_CARACTERES_TEXTO

from .temas import TEMAS

logger = logging.getLogger(__name__)

MODELO = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
MODELO_FALSO = 'falso/hash-384'
DIMENSOES = 384
# Pasta que o fastembed cria dentro de IA_MODELO_DIR para este modelo (cópia ONNX publicada pela Qdrant).
PASTA_CACHE_MODELO = 'models--Qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q'
NOVA_TENTATIVA_S = 300

# Sem telemetria do Hugging Face e sem o aviso de links simbólicos do Windows.
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
os.environ.setdefault('HF_HUB_DISABLE_SYMLINKS_WARNING', '1')


# ── Implementações de embedding ─────────────────────────────────────────────────

class EmbedderFastembed:
    """Modelo real (fastembed + ONNX Runtime)."""

    nome = MODELO

    def __init__(self, pasta: str, apenas_local: bool):
        from fastembed import TextEmbedding  # import pesado (~4 s): só quando a IA é usada
        self._modelo = TextEmbedding(MODELO, cache_dir=pasta, local_files_only=apenas_local)

    def embed(self, textos: list[str], workers: int = 1) -> np.ndarray:
        # batch_size=1: medido mais rápido em CPU (72 ms/texto contra 136 ms com 32), porque o lote
        # preenche todos os textos até o tamanho do mais longo. Veja docs/algoritmo-compatibilidade.md, 11.8.
        # workers > 1: paralelismo de dados do fastembed (`parallel`): cria `workers` processos, cada um
        # carrega o modelo (~560 MB e alguns segundos) e recebe parte dos textos; a ordem é preservada.
        paralelo = workers if workers > 1 else None
        return np.array(list(self._modelo.embed(textos, batch_size=1, parallel=paralelo)), dtype=np.float32)


_PALAVRAS_VAZIAS = {
    'para', 'com', 'que', 'uma', 'umas', 'uns', 'mas', 'dos', 'das', 'nos', 'nas', 'sou', 'meu', 'minha',
    'meus', 'minhas', 'por', 'pra', 'pelo', 'pela', 'tem', 'tenho', 'mais', 'muito', 'muita', 'bem', 'tudo',
    'quem', 'como', 'gosto', 'adoro', 'sempre', 'casa', 'dia', 'the', 'and', 'nao', 'sim', 'est', 'esta',
}


def _sem_acento(texto: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')


class EmbedderFalso:
    """
    Embedder DETERMINÍSTICO para os testes (não baixa nem carrega modelo).

    Cada radical de palavra (5 primeiras letras, sem acento) vira um vetor pseudoaleatório fixo; o texto é
    a soma deles. Textos com palavras em comum ficam próximos; sem palavras em comum, perto de 0.
    """

    nome = MODELO_FALSO

    def embed(self, textos: list[str], workers: int = 1) -> np.ndarray:  # noqa: ARG002 — mesma assinatura do real
        return np.vstack([self._um(t) for t in textos]).astype(np.float32)

    @staticmethod
    def _um(texto: str) -> np.ndarray:
        v = np.zeros(DIMENSOES)
        for palavra in re.findall(r'\w+', _sem_acento(texto.lower())):
            if len(palavra) < 3 or palavra in _PALAVRAS_VAZIAS:
                continue
            semente = int.from_bytes(hashlib.md5(palavra[:5].encode()).digest()[:4], 'little')
            v += np.random.default_rng(semente).standard_normal(DIMENSOES)
        if not v.any():
            v[0] = 1.0
        return v


# ── Estado do processo (protegido pela trava) ──────────────────────────────────

# _trava protege o dicionário de estado (seguro por pouco tempo: o status nunca espera a carga);
# _trava_carga garante UMA carga por vez (quem chega durante a carga espera por ela e reaproveita o modelo).
_trava = threading.RLock()
_trava_carga = threading.Lock()
_estado: dict = {}

SITUACOES = {
    'nao_carregado': 'Não carregado',
    'carregando': 'Carregando',
    'disponivel': 'Disponível',
    'indisponivel': 'Indisponível',
    'desabilitada': 'Desligada',
}


def reiniciar() -> None:
    """Esquece o modelo carregado e as falhas (usado pelos testes e por baixar_modelo_ia)."""
    with _trava:
        _estado.clear()
        _estado.update(embedder=None, situacao='nao_carregado', erro='', tentativa=0.0,
                       tempo_carga_ms=None, carregado_em=None, temas=None)


reiniciar()


def _depois_do_fork() -> None:
    """
    Processo filho de um fork (gunicorn --preload, por exemplo; chamado por ia/aquecimento.py): travas novas e
    estado zerado. O modelo é recarregado sob demanda no filho: uma sessão ONNX não sobrevive ao fork e uma
    trava pode ter ficado presa por uma thread que não existe no filho.
    """
    global _trava, _trava_carga
    _trava = threading.RLock()
    _trava_carga = threading.Lock()
    reiniciar()



def habilitada() -> bool:
    return bool(getattr(settings, 'IA_HABILITADA', True))


def usando_falso() -> bool:
    return getattr(settings, 'IA_EMBEDDER', 'fastembed') == 'falso'


def nome_modelo() -> str:
    return MODELO_FALSO if usando_falso() else MODELO


def pasta_modelo() -> str:
    return str(getattr(settings, 'IA_MODELO_DIR', '') or os.path.join(settings.BASE_DIR, '.modelos'))


def modelo_baixado() -> bool:
    """Os arquivos do modelo já estão na pasta IA_MODELO_DIR (funciona offline)?"""
    if usando_falso():
        return True
    base = os.path.join(pasta_modelo(), PASTA_CACHE_MODELO)
    return bool(glob.glob(os.path.join(base, 'snapshots', '*', '*.onnx')))


def _criar_embedder(baixar: bool):
    if usando_falso():
        return EmbedderFalso()
    # Com o modelo já baixado, carrega SÓ do disco (nenhum acesso à rede).
    return EmbedderFastembed(pasta_modelo(), apenas_local=(modelo_baixado() and not baixar))


def _pronto():
    if _estado['embedder'] is not None and _estado['embedder'].nome == nome_modelo():
        return _estado['embedder']
    return None


def obter_embedder(forcar: bool = False, baixar: bool = False):
    """O embedder carregado, ou None (IA desligada ou indisponível). Nunca levanta exceção."""
    if not habilitada():
        return None
    with _trava:
        if (pronto := _pronto()) is not None:
            return pronto
    with _trava_carga:
        with _trava:
            if (pronto := _pronto()) is not None:  # outra thread acabou de carregar
                return pronto
            if (_estado['situacao'] == 'indisponivel' and not forcar
                    and time.monotonic() - _estado['tentativa'] < NOVA_TENTATIVA_S):
                return None
            _estado.update(situacao='carregando', tentativa=time.monotonic())
        inicio = time.perf_counter()
        try:
            embedder = _criar_embedder(baixar)
            embedder.embed(['aquecimento do modelo'])
        except Exception as erro:  # noqa: BLE001 — sem internet, arquivo corrompido, falta de memória: nunca vira 500
            logger.warning('Afinidade por IA indisponível: não foi possível carregar o modelo %s (%s: %s). '
                           'O score segue com os 6 critérios.', nome_modelo(), type(erro).__name__, erro)
            with _trava:
                _estado.update(embedder=None, situacao='indisponivel', erro=f'{type(erro).__name__}: {erro}'[:300], temas=None)
            return None
        ms = (time.perf_counter() - inicio) * 1000
        with _trava:
            _estado.update(embedder=embedder, situacao='disponivel', erro='', tempo_carga_ms=round(ms, 1),
                           carregado_em=time.time(), temas=None)
        logger.info('Modelo de IA %s carregado em %.0f ms.', embedder.nome, ms)
        return embedder


def aquecer() -> None:
    """Carrega o modelo e as frases dos temas (thread de aquecimento do servidor; nunca levanta exceção)."""
    try:
        if obter_embedder() is not None:
            _matriz_temas()
    except Exception:  # noqa: BLE001 — o aquecimento é só uma antecipação; o uso normal tenta de novo
        logger.exception('Falha no aquecimento do modelo de IA.')


def disponivel(carregar: bool = False) -> bool:
    """
    A IA pode ser usada? Com carregar=False não carrega o modelo: responde pelo estado atual
    (carregado → sim; falhou → não; ainda não carregado → se os arquivos já estão baixados).
    """
    if not habilitada():
        return False
    if carregar:
        return obter_embedder() is not None
    with _trava:
        situacao = _estado['situacao']
    if situacao == 'disponivel':
        return True
    if situacao == 'indisponivel':
        return False
    return modelo_baixado()  # não carregado ou carregando: pronto assim que a carga terminar


def estado() -> dict:
    with _trava:
        situacao = _estado['situacao'] if habilitada() else 'desabilitada'
        return {
            'situacao': situacao,
            'situacao_texto': SITUACOES[situacao],
            'erro': _estado['erro'] or None,
            'tempo_carregamento_ms': _estado['tempo_carga_ms'],
            'carregado_em': _estado['carregado_em'],
        }


# ── Embeddings ─────────────────────────────────────────────────────────────────

def _normalizar(matriz: np.ndarray) -> np.ndarray:
    m = np.asarray(matriz, dtype=np.float64)
    normas = np.linalg.norm(m, axis=1, keepdims=True)
    normas[normas == 0] = 1.0
    return m / normas


def gerar_vetores(textos: list[str], workers: int = 1) -> np.ndarray | None:
    """
    Vetores normalizados (n × 384, float64) dos textos, ou None se a IA não estiver disponível.
    workers > 1 só nos processamentos em lote (gerar_embeddings): o resultado é idêntico ao de workers=1.
    """
    embedder = obter_embedder()
    if embedder is None or not textos:
        return None
    try:
        brutos = embedder.embed(list(textos), workers=workers)
    except Exception:
        logger.exception('Falha ao gerar embeddings (%d texto(s), %d worker(s)).', len(textos), workers)
        return None
    if brutos.ndim != 2 or brutos.shape[1] != DIMENSOES:
        logger.error('Embedding com formato inesperado: %s.', brutos.shape)
        return None
    return _normalizar(brutos)


# ── Temas (classificação zero-shot) ────────────────────────────────────────────

def _matriz_temas():
    """(frases × 384, índice do tema de cada frase), calculado uma vez por embedder."""
    with _trava:
        cache = _estado['temas']
        if cache is not None and cache[0] == nome_modelo():
            return cache[1], cache[2]
    frases = [f for t in TEMAS for f in t['frases']]
    dono = np.array([i for i, t in enumerate(TEMAS) for _ in t['frases']], dtype=np.intp)
    vetores = gerar_vetores(frases)
    if vetores is None:
        return None, None
    with _trava:
        _estado['temas'] = (nome_modelo(), vetores, dono)
    return vetores, dono


def pontuar_temas(vetores: np.ndarray) -> np.ndarray | None:
    """Matriz (n × temas): maior cosseno de cada texto com as frases de cada tema."""
    frases, dono = _matriz_temas()
    if frases is None:
        return None
    sims = np.asarray(vetores, dtype=np.float64) @ frases.T
    return np.stack([sims[:, dono == i].max(axis=1) for i in range(len(TEMAS))], axis=1)


def temas_de_vetores(vetores: np.ndarray) -> list[list[str]] | None:
    """Ids dos temas de cada texto: cosseno >= LIMIAR_TEMA e >= média do texto + MARGEM_TEMA."""
    notas = pontuar_temas(vetores)
    if notas is None:
        return None
    saida = []
    for linha in notas:
        media = float(linha.mean())
        ordem = np.argsort(-linha, kind='stable')
        ids = [TEMAS[j]['id'] for j in ordem
               if linha[j] >= LIMIAR_TEMA and linha[j] - media >= MARGEM_TEMA][:MAX_TEMAS]
        saida.append(ids)
    return saida


# ── Texto de origem ────────────────────────────────────────────────────────────

def texto_do_perfil(perfil) -> str:
    """'Sobre você' + (para quem oferece vaga) título e descrição do anúncio."""
    partes = [perfil.bio or '']
    tipo = getattr(getattr(perfil, 'usuario', None), 'tipo', '')
    if tipo == 'oferecendo_vaga':
        partes += [perfil.titulo_anuncio or '', perfil.descricao_imovel or '']
    return '\n'.join(p.strip() for p in partes if p and p.strip())


def caracteres_uteis(texto: str) -> int:
    """Letras e dígitos (espaços, pontuação e símbolos não contam)."""
    return sum(1 for c in texto or '' if c.isalnum())


def texto_suficiente(texto: str) -> bool:
    return caracteres_uteis(texto) >= MIN_CARACTERES_TEXTO


def hash_texto(texto: str) -> str:
    return hashlib.sha256((texto or '').encode('utf-8')).hexdigest()
