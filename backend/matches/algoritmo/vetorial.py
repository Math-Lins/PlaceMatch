"""
Implementação vetorial (NumPy) para cálculo em lote.

calcular_scores_lote(base, outros) → (ids: np.ndarray, scores: np.ndarray)

Cada linha de 'outros' é um perfil; as operações são feitas em arrays,
eliminando o loop Python da versão escalar.
"""

from __future__ import annotations

import numpy as np

from .config import (
    PESOS,
    DIV_ESCALA_5, DIV_MORADORES, DIV_IDADE,
    HORARIO_IDX, HORARIO_MATRIX,
    VISITAS_IDX, VISITAS_MATRIX,
    IMOVEL_IDX,  IMOVEL_MATRIX,
)

# Pré-converte as matrizes para arrays NumPy uma única vez no import
_NP_HORARIO = np.array(HORARIO_MATRIX, dtype=np.float64)
_NP_VISITAS = np.array(VISITAS_MATRIX, dtype=np.float64)
_NP_IMOVEL  = np.array(IMOVEL_MATRIX,  dtype=np.float64)


def calcular_scores_lote(base, outros) -> tuple[np.ndarray, np.ndarray]:
    """
    Calcula a compatibilidade de `base` contra cada perfil em `outros`.

    Parâmetros
    ----------
    base   : Perfil (ou objeto com os mesmos atributos)
    outros : iterável de Perfil

    Retorno
    -------
    ids    : np.ndarray de int com os IDs dos perfis em `outros`
    scores : np.ndarray de float64 com os scores correspondentes (0-1)
    """
    outros_list = list(outros)
    n = len(outros_list)

    if n == 0:
        return np.array([], dtype=np.int64), np.array([], dtype=np.float64)

    ids = np.array([p.id for p in outros_list], dtype=np.int64)

    # ── Orçamento ──────────────────────────────────────────────────────────
    min_a = float(base.orcamento_min)
    max_a = float(base.orcamento_max)
    min_b = np.array([float(p.orcamento_min) for p in outros_list], dtype=np.float64)
    max_b = np.array([float(p.orcamento_max) for p in outros_list], dtype=np.float64)

    overlap    = np.maximum(0.0, np.minimum(max_a, max_b) - np.maximum(min_a, min_b))
    max_range  = np.maximum(max_a - min_a, np.maximum(max_b - min_b, 1.0))
    sim_orc    = np.minimum(1.0, overlap / max_range)

    # ── Região ─────────────────────────────────────────────────────────────
    regiao_a = base.regiao.strip().lower()
    sim_reg  = np.array(
        [1.0 if p.regiao.strip().lower() == regiao_a else 0.0 for p in outros_list],
        dtype=np.float64,
    )

    # ── Rotina ─────────────────────────────────────────────────────────────
    hi_a = HORARIO_IDX.get(base.perfil_horario, 2)
    hi_b = np.array([HORARIO_IDX.get(p.perfil_horario, 2) for p in outros_list], dtype=np.intp)
    sim_hor = _NP_HORARIO[hi_a, hi_b]

    nr_a    = float(base.nivel_ruido)
    nr_b    = np.array([float(p.nivel_ruido) for p in outros_list], dtype=np.float64)
    sim_rui = 1.0 - np.abs(nr_a - nr_b) / DIV_ESCALA_5

    sim_rot = (sim_hor + sim_rui) / 2.0

    # ── Hábitos ────────────────────────────────────────────────────────────
    sim_fum = np.array(
        [1.0 if p.fumante == base.fumante else 0.0 for p in outros_list],
        dtype=np.float64,
    )
    sim_pet = np.array(
        [1.0 if p.aceita_pets == base.aceita_pets else 0.0 for p in outros_list],
        dtype=np.float64,
    )

    vi_a    = VISITAS_IDX.get(base.aceita_visitas, 1)
    vi_b    = np.array([VISITAS_IDX.get(p.aceita_visitas, 1) for p in outros_list], dtype=np.intp)
    sim_vis = _NP_VISITAS[vi_a, vi_b]

    tb_a    = float(base.tolerancia_bagunca)
    tb_b    = np.array([float(p.tolerancia_bagunca) for p in outros_list], dtype=np.float64)
    sim_bag = 1.0 - np.abs(tb_a - tb_b) / DIV_ESCALA_5

    no_a    = float(base.nivel_organizacao)
    no_b    = np.array([float(p.nivel_organizacao) for p in outros_list], dtype=np.float64)
    sim_org = 1.0 - np.abs(no_a - no_b) / DIV_ESCALA_5

    ns_a    = float(base.nivel_social)
    ns_b    = np.array([float(p.nivel_social) for p in outros_list], dtype=np.float64)
    sim_soc = 1.0 - np.abs(ns_a - ns_b) / DIV_ESCALA_5

    sim_hab = (sim_fum + sim_pet + sim_vis + sim_bag + sim_org + sim_soc) / 6.0

    # ── Moradia ────────────────────────────────────────────────────────────
    im_a    = IMOVEL_IDX.get(base.tipo_imovel, 3)
    im_b    = np.array([IMOVEL_IDX.get(p.tipo_imovel, 3) for p in outros_list], dtype=np.intp)
    sim_tip = _NP_IMOVEL[im_a, im_b]

    qm_a    = float(base.qtd_moradores)
    qm_b    = np.array([float(p.qtd_moradores) for p in outros_list], dtype=np.float64)
    sim_qtd = 1.0 - np.abs(qm_a - qm_b) / DIV_MORADORES

    sim_mor = (sim_tip + sim_qtd) / 2.0

    # ── Faixa etária ───────────────────────────────────────────────────────
    id_a    = float(base.idade)
    id_b    = np.array([float(p.idade) for p in outros_list], dtype=np.float64)
    sim_ida = np.maximum(0.0, 1.0 - np.abs(id_a - id_b) / DIV_IDADE)

    # ── Score final ────────────────────────────────────────────────────────
    # A soma ponderada é feita em Python float para que a ordem e o modo de
    # arredondamento sejam idênticos ao de calcular_score (escalar).  Sem isso,
    # operações em array NumPy podem diferir em 1 ULP no raw, cruzando um
    # limite de arredondamento em 4 casas e produzindo um score divergente.
    scores = np.array([
        round(max(0.0, min(1.0,
            PESOS['orcamento'] * float(sim_orc[i])
            + PESOS['regiao']  * float(sim_reg[i])
            + PESOS['rotina']  * float(sim_rot[i])
            + PESOS['habitos'] * float(sim_hab[i])
            + PESOS['moradia'] * float(sim_mor[i])
            + PESOS['idade']   * float(sim_ida[i])
        )), 4)
        for i in range(n)
    ], dtype=np.float64)
    return ids, scores
