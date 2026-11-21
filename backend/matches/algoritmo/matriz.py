"""
Cálculo da compatibilidade em MATRIZ (todos os perfis de um tipo × todos do tipo oposto), sem Django.

É o núcleo do recálculo completo (`recalcular_compatibilidades`, veja matches/processamento.py). Os
atributos de cada grupo de perfis chegam como arrays NumPy (`Grupo`), e um bloco de linhas do grupo A é
comparado com um bloco de colunas do grupo B por broadcasting (até 256 × 256 pares por vez). Este módulo não acessa o banco nem carrega o modelo
de IA: os workers de processo importam só ele e recebem os arrays prontos.

Resultado IDÊNTICO ao escalar (calcular_score) e ao vetorial (calcular_scores_lote):
  - cada semelhança usa as mesmas operações, na mesma ordem, em float64 (IEEE 754: o mesmo resultado
    elemento a elemento que em Python);
  - a soma ponderada segue a ordem de afinidade.combinar;
  - round(x, 4) do Python é reproduzido EXATAMENTE por arredondar4 (np.round não é igual a round em
    valores perto de ...5);
  - o score volta como inteiro (score × 10000, uint16), que vira float com k / 10000 = round(score, 4).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .config import (
    CRITERIO_IA,
    CRITERIOS_ESTRUTURADOS,
    DIV_ESCALA_5, DIV_IDADE, DIV_MORADORES,
    HORARIO_IDX, HORARIO_MATRIX,
    IA_CASAS_COSSENO, IA_COSSENO_PISO, IA_COSSENO_TETO,
    IMOVEL_IDX, IMOVEL_MATRIX,
    PESOS,
    VISITAS_IDX, VISITAS_MATRIX,
)

_NP_HORARIO = np.array(HORARIO_MATRIX, dtype=np.float64)
_NP_VISITAS = np.array(VISITAS_MATRIX, dtype=np.float64)
_NP_IMOVEL = np.array(IMOVEL_MATRIX, dtype=np.float64)

ESCALA = 10_000  # 4 casas decimais
# Tamanho do bloco (ladrilho) de pares: 256 linhas × 256 colunas = 65.536 pares, 512 KB por array float64.
# Medido: no Windows, arrays acima de ~1 MB custam ~8× mais por elemento (cada operação aloca memória nova
# direto do sistema e paga as faltas de página); até 512 KB o alocador reaproveita a memória. O formato
# quadrado deixa os embeddings do bloco (2 × 256 × 384 floats = 1,5 MB) caberem no cache L3 (3 MB): com
# 64 × 1024 o sequencial ficou ~1,6× mais lento.
# A divisão é FIXA (depende só do tamanho dos grupos, nunca do número de workers): o resultado não muda
# com 1, 2 ou 8 workers.
LINHAS_POR_BLOCO = 256
COLUNAS_POR_BLOCO = 256

assert IA_CASAS_COSSENO == 4, 'arredondar4 supõe 4 casas decimais'


@dataclass
class Grupo:
    """Atributos de n perfis (um por linha), já convertidos para arrays."""

    ids: np.ndarray            # int64
    orc_min: np.ndarray        # float64
    orc_max: np.ndarray
    regiao: np.ndarray         # int32 (código da região normalizada: strip().lower())
    horario: np.ndarray        # intp (índice em HORARIO_MATRIX)
    ruido: np.ndarray          # float64
    fumante: np.ndarray        # bool
    pets: np.ndarray           # bool
    visitas: np.ndarray        # intp
    bagunca: np.ndarray        # float64
    organizacao: np.ndarray
    social: np.ndarray
    imovel: np.ndarray         # intp
    moradores: np.ndarray      # float64
    idade: np.ndarray
    vetores: np.ndarray        # float32 (n × 384); linhas sem embedding ficam zeradas
    tem_vetor: np.ndarray      # bool

    def vetores64(self) -> np.ndarray:
        """Vetores em float64 (convertidos uma vez por processo; float32 → float64 é exato)."""
        cache = self.__dict__.get('_vetores64')
        if cache is None:
            cache = self.vetores.astype(np.float64)
            self.__dict__['_vetores64'] = cache
        return cache

    def __getstate__(self):  # o cache não viaja para os workers (cada um converte o seu)
        estado = dict(self.__dict__)
        estado.pop('_vetores64', None)
        return estado

    def __len__(self) -> int:
        return int(self.ids.shape[0])

    def nbytes(self) -> int:
        return sum(getattr(self, c).nbytes for c in self.__dataclass_fields__)


def montar_grupo(perfis: list[dict], codigos_regiao: dict[str, int], dimensoes: int = 384) -> Grupo:
    """
    perfis: dicts com os campos do Perfil (+ 'vetor': np.ndarray float32 normalizado ou None).
    codigos_regiao: região normalizada → código (o MESMO dicionário para os dois grupos).
    """
    n = len(perfis)

    def f(campo):
        return np.array([float(p[campo]) for p in perfis], dtype=np.float64)

    def reg(p):
        chave = (p['regiao'] or '').strip().lower()
        return codigos_regiao.setdefault(chave, len(codigos_regiao))

    vetores = np.zeros((n, dimensoes), dtype=np.float32)
    tem = np.zeros(n, dtype=bool)
    for i, p in enumerate(perfis):
        v = p.get('vetor')
        if v is not None:
            vetores[i] = v
            tem[i] = True
    return Grupo(
        ids=np.array([p['id'] for p in perfis], dtype=np.int64),
        orc_min=f('orcamento_min'), orc_max=f('orcamento_max'),
        regiao=np.array([reg(p) for p in perfis], dtype=np.int32),
        horario=np.array([HORARIO_IDX.get(p['perfil_horario'], 2) for p in perfis], dtype=np.intp),
        ruido=f('nivel_ruido'),
        fumante=np.array([bool(p['fumante']) for p in perfis], dtype=bool),
        pets=np.array([bool(p['aceita_pets']) for p in perfis], dtype=bool),
        visitas=np.array([VISITAS_IDX.get(p['aceita_visitas'], 1) for p in perfis], dtype=np.intp),
        bagunca=f('tolerancia_bagunca'), organizacao=f('nivel_organizacao'), social=f('nivel_social'),
        imovel=np.array([IMOVEL_IDX.get(p['tipo_imovel'], 3) for p in perfis], dtype=np.intp),
        moradores=f('qtd_moradores'), idade=f('idade'),
        vetores=vetores, tem_vetor=tem,
    )


def arredondar4(x: np.ndarray) -> np.ndarray:
    """round(v, 4) do Python, elemento a elemento e EXATO (inclusive o arredondamento para o par)."""
    y = x * float(ESCALA)
    r = np.rint(y) / float(ESCALA)
    # Perto de ...,5 o produto x × 10000 pode ter errado o lado; esses (raríssimos) vão para o round do Python.
    duvidosos = np.abs(np.abs(y - np.floor(y)) - 0.5) < 1e-6
    if duvidosos.any():
        idx = np.nonzero(duvidosos)
        r[idx] = [round(float(v), 4) for v in x[idx]]
    return r


def _diff(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.abs(a[:, None] - b[None, :])


def calcular_bloco(A: Grupo, B: Grupo, bloco: tuple[int, int, int, int], pesos: dict | None = None,
                   com_ia: bool = True) -> np.ndarray:
    """
    Scores de A[i0:i1] × B[j0:j1] como inteiros (score × 10000), matriz uint16 (i1-i0 × j1-j0).
    As fórmulas são as de vetorial.calcular_scores_lote (mesma ordem das operações).
    """
    pesos = PESOS if pesos is None else pesos
    i0, i1, j0, j1 = bloco
    s = slice(i0, i1)
    B = _Fatia(B, slice(j0, j1))

    # Orçamento
    min_a, max_a = A.orc_min[s, None], A.orc_max[s, None]
    min_b, max_b = B.orc_min[None, :], B.orc_max[None, :]
    overlap = np.maximum(0.0, np.minimum(max_a, max_b) - np.maximum(min_a, min_b))
    max_range = np.maximum(max_a - min_a, np.maximum(max_b - min_b, 1.0))
    sim_orc = np.minimum(1.0, overlap / max_range)
    del overlap, max_range

    # Região
    sim_reg = (A.regiao[s, None] == B.regiao[None, :]).astype(np.float64)

    # Rotina
    sim_hor = _NP_HORARIO[A.horario[s, None], B.horario[None, :]]
    sim_rui = 1.0 - _diff(A.ruido[s], B.ruido) / DIV_ESCALA_5
    sim_rot = (sim_hor + sim_rui) / 2.0
    del sim_hor, sim_rui

    # Hábitos (mesma ordem da soma do escalar)
    sim_hab = (A.fumante[s, None] == B.fumante[None, :]).astype(np.float64)
    sim_hab += (A.pets[s, None] == B.pets[None, :])
    sim_hab += _NP_VISITAS[A.visitas[s, None], B.visitas[None, :]]
    sim_hab += 1.0 - _diff(A.bagunca[s], B.bagunca) / DIV_ESCALA_5
    sim_hab += 1.0 - _diff(A.organizacao[s], B.organizacao) / DIV_ESCALA_5
    sim_hab += 1.0 - _diff(A.social[s], B.social) / DIV_ESCALA_5
    sim_hab /= 6.0

    # Moradia
    sim_mor = _NP_IMOVEL[A.imovel[s, None], B.imovel[None, :]]
    sim_mor = (sim_mor + (1.0 - _diff(A.moradores[s], B.moradores) / DIV_MORADORES)) / 2.0

    # Idade
    sim_ida = np.maximum(0.0, 1.0 - _diff(A.idade[s], B.idade) / DIV_IDADE)

    # Soma ponderada na ordem de afinidade.combinar
    sims = dict(zip(CRITERIOS_ESTRUTURADOS, (sim_orc, sim_reg, sim_rot, sim_hab, sim_mor, sim_ida)))
    soma = None
    total = 0.0
    for chave in CRITERIOS_ESTRUTURADOS:
        peso = pesos[chave]
        termo = peso * sims[chave]
        soma = termo if soma is None else soma + termo
        total += peso
    del sims, sim_orc, sim_reg, sim_rot, sim_hab, sim_mor, sim_ida
    bruto = soma / total

    # Afinidade por IA (só nos pares em que os dois têm embedding)
    if com_ia:
        mascara = A.tem_vetor[s, None] & B.tem_vetor[None, :]
        if mascara.any():
            cos = arredondar4(A.vetores64()[s] @ B.vetores64().T)
            afin = arredondar4(np.clip((cos - IA_COSSENO_PISO) / (IA_COSSENO_TETO - IA_COSSENO_PISO), 0.0, 1.0))
            peso_ia = pesos.get(CRITERIO_IA, 0.0)
            com = (soma + peso_ia * afin) / (total + peso_ia)
            bruto = np.where(mascara, com, bruto)

    score = arredondar4(np.clip(bruto, 0.0, 1.0))
    return np.rint(score * float(ESCALA)).astype(np.uint16)


class _Fatia:
    """Visão das colunas j0:j1 de um Grupo (os arrays são fatias, sem cópia)."""

    def __init__(self, grupo: Grupo, s: slice):
        self._g, self._s = grupo, s

    def __getattr__(self, nome):
        return getattr(self._g, nome)[self._s]

    def vetores64(self):
        return self._g.vetores64()[self._s]


def blocos(n_a: int, n_b: int) -> list[tuple[int, int, int, int]]:
    """Divisão fixa dos pares em blocos (i0, i1, j0, j1) de até 256 × 256 (independe do número de workers)."""
    return [(i, min(i + LINHAS_POR_BLOCO, n_a), j, min(j + COLUNAS_POR_BLOCO, n_b))
            for i in range(0, n_a, LINHAS_POR_BLOCO) for j in range(0, n_b, COLUNAS_POR_BLOCO)]
