"""
Implementação escalar do algoritmo de compatibilidade.

Mesma lógica do compatibilidade.py original, mas dirigida por tabelas
definidas em config.py — sem if/else espalhados.
"""

from .config import (
    PESOS,
    DIV_ESCALA_5, DIV_MORADORES, DIV_IDADE,
    HORARIO_IDX, HORARIO_MATRIX,
    VISITAS_IDX, VISITAS_MATRIX,
    IMOVEL_IDX,  IMOVEL_MATRIX,
)


def _sim_horario(a: str, b: str) -> float:
    i = HORARIO_IDX.get(a, 2)  # default flexivel
    j = HORARIO_IDX.get(b, 2)
    return HORARIO_MATRIX[i][j]


def _sim_visitas(a: str, b: str) -> float:
    i = VISITAS_IDX.get(a, 1)  # default as_vezes
    j = VISITAS_IDX.get(b, 1)
    return VISITAS_MATRIX[i][j]


def _sim_imovel(a: str, b: str) -> float:
    i = IMOVEL_IDX.get(a, 3)   # default indiferente
    j = IMOVEL_IDX.get(b, 3)
    return IMOVEL_MATRIX[i][j]


def calcular_score(perfil_a, perfil_b) -> float:
    """
    Calcula o score de compatibilidade entre dois perfis.
    Retorna um float entre 0.0 e 1.0.
    """

    # -- Orçamento ------------------------------------------------------------
    min_a, max_a = float(perfil_a.orcamento_min), float(perfil_a.orcamento_max)
    min_b, max_b = float(perfil_b.orcamento_min), float(perfil_b.orcamento_max)
    overlap = max(0.0, min(max_a, max_b) - max(min_a, min_b))
    max_range = max(max_a - min_a, max_b - min_b, 1.0)
    sim_orcamento = min(1.0, overlap / max_range)

    # -- Região ---------------------------------------------------------------
    sim_regiao = 1.0 if perfil_a.regiao.strip().lower() == perfil_b.regiao.strip().lower() else 0.0

    # -- Rotina ---------------------------------------------------------------
    sim_horario = _sim_horario(perfil_a.perfil_horario, perfil_b.perfil_horario)
    sim_ruido = 1.0 - abs(perfil_a.nivel_ruido - perfil_b.nivel_ruido) / DIV_ESCALA_5
    sim_rotina = (sim_horario + sim_ruido) / 2.0

    # -- Hábitos de convivência -----------------------------------------------
    sim_fumante  = 1.0 if perfil_a.fumante == perfil_b.fumante else 0.0
    sim_pets     = 1.0 if perfil_a.aceita_pets == perfil_b.aceita_pets else 0.0
    sim_visitas  = _sim_visitas(perfil_a.aceita_visitas, perfil_b.aceita_visitas)
    sim_bagunca  = 1.0 - abs(perfil_a.tolerancia_bagunca - perfil_b.tolerancia_bagunca) / DIV_ESCALA_5
    sim_org      = 1.0 - abs(perfil_a.nivel_organizacao - perfil_b.nivel_organizacao) / DIV_ESCALA_5
    sim_social   = 1.0 - abs(perfil_a.nivel_social - perfil_b.nivel_social) / DIV_ESCALA_5
    sim_habitos  = (sim_fumante + sim_pets + sim_visitas + sim_bagunca + sim_org + sim_social) / 6.0

    # -- Estilo de moradia ----------------------------------------------------
    sim_tipo  = _sim_imovel(perfil_a.tipo_imovel, perfil_b.tipo_imovel)
    sim_qtd   = 1.0 - abs(perfil_a.qtd_moradores - perfil_b.qtd_moradores) / DIV_MORADORES
    sim_moradia = (sim_tipo + sim_qtd) / 2.0

    # -- Faixa etária ---------------------------------------------------------
    diff_idade = abs(perfil_a.idade - perfil_b.idade)
    sim_idade  = max(0.0, 1.0 - diff_idade / DIV_IDADE)

    # -- Score final ----------------------------------------------------------
    score = (
        PESOS['orcamento'] * sim_orcamento
        + PESOS['regiao']  * sim_regiao
        + PESOS['rotina']  * sim_rotina
        + PESOS['habitos'] * sim_habitos
        + PESOS['moradia'] * sim_moradia
        + PESOS['idade']   * sim_idade
    )

    return round(max(0.0, min(1.0, score)), 4)
