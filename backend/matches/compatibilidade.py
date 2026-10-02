"""
Algoritmo de compatibilidade entre perfis.

Pesos:
  - Orçamento (25%): sobreposição das faixas [orcamento_min, orcamento_max]
  - Região (20%): 1.0 se igual (case-insensitive), 0.0 caso contrário
  - Rotina (20%): proxy via tolerancia_bagunca + nivel_organizacao (ver comentário abaixo)
  - Hábitos de convivência (25%): fumante, aceita_pets, tolerancia_bagunca, nivel_organizacao
  - Faixa etária (10%): diferença de idade normalizada (0 anos = 1.0, >= 20 anos = 0.0)
"""


def calcular_score(perfil_a, perfil_b) -> float:
    """
    Calcula o score de compatibilidade entre dois perfis.
    Retorna um float entre 0.0 e 1.0.
    """

    # ── Orçamento (25%) ──────────────────────────────────────────────────────
    # Sobreposição das faixas de orçamento, normalizada pelo maior intervalo.
    min_a, max_a = float(perfil_a.orcamento_min), float(perfil_a.orcamento_max)
    min_b, max_b = float(perfil_b.orcamento_min), float(perfil_b.orcamento_max)

    overlap_start = max(min_a, min_b)
    overlap_end = min(max_a, max_b)
    overlap = max(0.0, overlap_end - overlap_start)

    range_a = max_a - min_a
    range_b = max_b - min_b
    max_range = max(range_a, range_b, 1.0)  # evitar divisão por zero
    sim_orcamento = min(1.0, overlap / max_range)

    # ── Região (20%) ─────────────────────────────────────────────────────────
    sim_regiao = 1.0 if perfil_a.regiao.strip().lower() == perfil_b.regiao.strip().lower() else 0.0

    # ── Rotina (20%) ─────────────────────────────────────────────────────────
    # O modelo atual não possui campo explícito de "rotina" (horário, trabalho, etc.).
    # Como proxy, combinamos tolerancia_bagunca e nivel_organizacao: perfis com
    # valores próximos têm rotinas compatíveis.
    # TODO: quando um campo de rotina for adicionado ao Perfil (sprint futura),
    #       substituir este proxy pelo cálculo direto sobre o campo real.
    diff_bagunca = abs(perfil_a.tolerancia_bagunca - perfil_b.tolerancia_bagunca) / 4.0  # range 1-5 → diff máx. 4
    diff_org = abs(perfil_a.nivel_organizacao - perfil_b.nivel_organizacao) / 4.0
    sim_rotina = 1.0 - (diff_bagunca + diff_org) / 2.0

    # ── Hábitos de convivência (25%) ─────────────────────────────────────────
    # fumante e aceita_pets: igualdade booleana
    # tolerancia_bagunca e nivel_organizacao: proximidade normalizada
    sim_fumante = 1.0 if perfil_a.fumante == perfil_b.fumante else 0.0
    sim_pets = 1.0 if perfil_a.aceita_pets == perfil_b.aceita_pets else 0.0
    sim_bagunca = 1.0 - abs(perfil_a.tolerancia_bagunca - perfil_b.tolerancia_bagunca) / 4.0
    sim_org = 1.0 - abs(perfil_a.nivel_organizacao - perfil_b.nivel_organizacao) / 4.0
    sim_habitos = (sim_fumante + sim_pets + sim_bagunca + sim_org) / 4.0

    # ── Faixa etária (10%) ───────────────────────────────────────────────────
    # Diferença de 0 anos = 1.0; diferença >= 20 anos = 0.0 (interpolação linear)
    diff_idade = abs(perfil_a.idade - perfil_b.idade)
    sim_idade = max(0.0, 1.0 - diff_idade / 20.0)

    # ── Score final ──────────────────────────────────────────────────────────
    score = (
        0.25 * sim_orcamento
        + 0.20 * sim_regiao
        + 0.20 * sim_rotina
        + 0.25 * sim_habitos
        + 0.10 * sim_idade
    )

    return round(max(0.0, min(1.0, score)), 4)
