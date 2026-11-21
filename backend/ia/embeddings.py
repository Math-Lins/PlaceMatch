"""
Geração e atualização do EmbeddingPerfil.

atualizar_embedding_perfil(perfil) é chamada pelo signal de Perfil (matches/signals.py) ANTES do
recálculo da compatibilidade. Só gera o embedding de novo quando o hash do texto de origem (ou o modelo)
mudou. Nunca levanta exceção: qualquer falha vai para o logger e o perfil segue sem o 7º critério.
"""

from __future__ import annotations

import logging
import time

from perfis.models import Perfil

from . import servico
from .models import EmbeddingPerfil

logger = logging.getLogger(__name__)

# Resultados possíveis (o comando gerar_embeddings conta cada um)
CRIADO, ATUALIZADO, INALTERADO, REMOVIDO, SEM_TEXTO, INDISPONIVEL, DESABILITADA, ERRO = (
    'criado', 'atualizado', 'inalterado', 'removido', 'sem_texto', 'indisponivel', 'desabilitada', 'erro',
)


def _guardar_no_cache(perfil, emb) -> None:
    """Deixa perfil.embedding_ia apontando para o valor novo (evita consulta e valor velho no recálculo)."""
    Perfil.embedding_ia.related.set_cached_value(perfil, emb)


def atualizar_embedding_perfil(perfil, forcar: bool = False) -> str:
    try:
        return _atualizar_lote([perfil], forcar)[0]
    except Exception:
        logger.exception('Falha ao atualizar o embedding do perfil %s.', getattr(perfil, 'pk', None))
        return ERRO


def atualizar_lote(perfis, forcar: bool = False, workers: int = 1) -> list[str]:
    """
    Mesma regra, com os textos de vários perfis passando juntos pelo modelo (comando gerar_embeddings).
    workers > 1: os textos pendentes são divididos entre `workers` processos do fastembed (resultado idêntico).
    """
    try:
        return _atualizar_lote(list(perfis), forcar, workers)
    except Exception:
        logger.exception('Falha ao atualizar embeddings em lote.')
        return [ERRO] * len(perfis)


def contar_pendentes(perfis, forcar: bool = False) -> int:
    """Quantos perfis precisariam passar pelo modelo (texto suficiente e novo/alterado), sem gerar nada."""
    if not servico.habilitada():
        return 0
    atuais = {pid: (h, m) for pid, h, m in EmbeddingPerfil.objects.filter(perfil_id__in=[p.pk for p in perfis])
              .values_list('perfil_id', 'hash_texto', 'modelo')}
    modelo = servico.nome_modelo()
    total = 0
    for p in perfis:
        texto = servico.texto_do_perfil(p)
        if servico.texto_suficiente(texto) and (forcar or atuais.get(p.pk) != (servico.hash_texto(texto), modelo)):
            total += 1
    return total


def _atualizar_lote(perfis: list, forcar: bool, workers: int = 1) -> list[str]:
    if not servico.habilitada():
        return [DESABILITADA] * len(perfis)
    resultados: list[str | None] = [None] * len(perfis)
    atuais = {e.perfil_id: e for e in EmbeddingPerfil.objects.filter(perfil_id__in=[p.pk for p in perfis])}
    modelo = servico.nome_modelo()

    pendentes = []  # (índice, perfil, texto, hash, embedding atual)
    sem_texto_ids = []
    for i, perfil in enumerate(perfis):
        texto = servico.texto_do_perfil(perfil)
        atual = atuais.get(perfil.pk)
        if not servico.texto_suficiente(texto):
            if atual is not None:
                sem_texto_ids.append(perfil.pk)
            resultados[i] = REMOVIDO if atual is not None else SEM_TEXTO
            _guardar_no_cache(perfil, None)
            continue
        h = servico.hash_texto(texto)
        if atual is not None and not forcar and atual.hash_texto == h and atual.modelo == modelo:
            resultados[i] = INALTERADO
            _guardar_no_cache(perfil, atual)
            continue
        pendentes.append((i, perfil, texto, h, atual))
    if sem_texto_ids:
        EmbeddingPerfil.objects.filter(perfil_id__in=sem_texto_ids).delete()
    if not pendentes:
        return resultados

    inicio = time.perf_counter()
    vetores = servico.gerar_vetores([t for _, _, t, _, _ in pendentes], workers=workers)
    temas = servico.temas_de_vetores(vetores) if vetores is not None else None
    if vetores is None or temas is None:
        # IA fora do ar: um vetor de texto ANTIGO não representa mais a bio → é apagado.
        velhos = [atual.pk for _, _, _, h, atual in pendentes
                  if atual is not None and (atual.hash_texto != h or atual.modelo != modelo)]
        if velhos:
            EmbeddingPerfil.objects.filter(pk__in=velhos).delete()
        for i, perfil, _, h, atual in pendentes:
            manter = atual is not None and atual.pk not in velhos
            _guardar_no_cache(perfil, atual if manter else None)
            resultados[i] = INDISPONIVEL
        return resultados
    ms_por_texto = (time.perf_counter() - inicio) * 1000 / len(pendentes)

    for (i, perfil, _, h, atual), vetor, ids_temas in zip(pendentes, vetores, temas):
        emb, criado = EmbeddingPerfil.objects.update_or_create(
            perfil_id=perfil.pk,
            defaults={
                'vetor': EmbeddingPerfil.empacotar(vetor), 'modelo': modelo, 'hash_texto': h,
                'temas': ids_temas, 'tempo_ms': round(ms_por_texto, 2),
            },
        )
        _guardar_no_cache(perfil, emb)
        resultados[i] = CRIADO if criado else ATUALIZADO
    return resultados
