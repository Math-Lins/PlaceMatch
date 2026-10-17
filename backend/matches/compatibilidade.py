"""
Algoritmo de compatibilidade entre perfis.

Pesos (total = 1.0):
  - Orçamento      20%: sobreposição das faixas [orcamento_min, orcamento_max]
  - Região         10%: 1.0 se igual (case-insensitive), 0.0 caso contrário
  - Rotina         15%: perfil_horario + nivel_ruido
  - Hábitos        25%: fumante, aceita_pets, aceita_visitas,
                        tolerancia_bagunca, nivel_organizacao, nivel_social
  - Estilo moradia 10%: tipo_imovel + qtd_moradores
  - Faixa etária   20%: diferença de idade (0 anos = 1.0, >= 20 anos = 0.0)
"""


def _sim_horario(a: str, b: str) -> float:
    """Compatibilidade de horário entre dois perfis."""
    if a == b:
        return 1.0
    if a == 'flexivel' or b == 'flexivel':
        return 0.6
    # madrugador vs noturno
    return 0.0


def _sim_visitas(a: str, b: str) -> float:
    """Compatibilidade de frequência de visitas."""
    ORDER = {'raramente': 0, 'as_vezes': 1, 'frequentemente': 2}
    diff = abs(ORDER.get(a, 1) - ORDER.get(b, 1))
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.5
    return 0.0


def _sim_imovel(a: str, b: str) -> float:
    """Compatibilidade de tipo de imóvel."""
    if a == b:
        return 1.0
    if a == 'indiferente' or b == 'indiferente':
        return 0.7
    return 0.0


def calcular_score(perfil_a, perfil_b) -> float:
    """
    Calcula o score de compatibilidade entre dois perfis.
    Retorna um float entre 0.0 e 1.0.
    """

    # -- Orçamento (20%) ------------------------------------------------------
    min_a, max_a = float(perfil_a.orcamento_min), float(perfil_a.orcamento_max)
    min_b, max_b = float(perfil_b.orcamento_min), float(perfil_b.orcamento_max)

    overlap = max(0.0, min(max_a, max_b) - max(min_a, min_b))
    max_range = max(max_a - min_a, max_b - min_b, 1.0)
    sim_orcamento = min(1.0, overlap / max_range)

    # -- Região (10%) ---------------------------------------------------------
    sim_regiao = 1.0 if perfil_a.regiao.strip().lower() == perfil_b.regiao.strip().lower() else 0.0

    # -- Rotina (15%) ---------------------------------------------------------
    sim_horario = _sim_horario(perfil_a.perfil_horario, perfil_b.perfil_horario)
    sim_ruido = 1.0 - abs(perfil_a.nivel_ruido - perfil_b.nivel_ruido) / 4.0
    sim_rotina = (sim_horario + sim_ruido) / 2.0

    # -- Hábitos de convivência (25%) -----------------------------------------
    sim_fumante = 1.0 if perfil_a.fumante == perfil_b.fumante else 0.0
    sim_pets = 1.0 if perfil_a.aceita_pets == perfil_b.aceita_pets else 0.0
    sim_visitas = _sim_visitas(perfil_a.aceita_visitas, perfil_b.aceita_visitas)
    sim_bagunca = 1.0 - abs(perfil_a.tolerancia_bagunca - perfil_b.tolerancia_bagunca) / 4.0
    sim_org = 1.0 - abs(perfil_a.nivel_organizacao - perfil_b.nivel_organizacao) / 4.0
    sim_social = 1.0 - abs(perfil_a.nivel_social - perfil_b.nivel_social) / 4.0
    sim_habitos = (sim_fumante + sim_pets + sim_visitas + sim_bagunca + sim_org + sim_social) / 6.0

    # -- Estilo de moradia (10%) -----------------------------------------------
    sim_tipo = _sim_imovel(perfil_a.tipo_imovel, perfil_b.tipo_imovel)
    sim_qtd = 1.0 - abs(perfil_a.qtd_moradores - perfil_b.qtd_moradores) / 3.0
    sim_moradia = (sim_tipo + sim_qtd) / 2.0

    # -- Faixa etária (20%) ---------------------------------------------------
    diff_idade = abs(perfil_a.idade - perfil_b.idade)
    sim_idade = max(0.0, 1.0 - diff_idade / 20.0)

    # -- Score final ----------------------------------------------------------
    score = (
        0.20 * sim_orcamento
        + 0.10 * sim_regiao
        + 0.15 * sim_rotina
        + 0.25 * sim_habitos
        + 0.10 * sim_moradia
        + 0.20 * sim_idade
    )

    return round(max(0.0, min(1.0, score)), 4)
