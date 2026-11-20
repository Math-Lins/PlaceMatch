"""
Única fonte de verdade para pesos e tabelas de similaridade.

Toda mudança de peso ou de regra deve acontecer AQUI — escalar.py e
vetorial.py apenas lêem estas constantes.

Pesos atuais (total = 1.0):
  orcamento 23% · habitos 22% · regiao 14% · rotina 14%
  moradia    9% · idade    8% · afinidade_ia 10%

O 7º critério (afinidade_ia) compara o significado das biografias com um modelo de linguagem
local (veja ia/servico.py e docs/algoritmo-compatibilidade.md, seção 11). Quando um dos dois perfis
não tem embedding (bio curta) ou a IA está desligada, o critério é IGNORADO e os outros 6 pesos são
renormalizados (divididos pela soma deles, 0,90): ninguém é penalizado por ter bio curta.
"""

# ---------------------------------------------------------------------------
# Pesos do score final (devem somar 1.0)
# ---------------------------------------------------------------------------
PESOS: dict[str, float] = {
    'orcamento':    0.23,
    'regiao':       0.14,
    'rotina':       0.14,
    'habitos':      0.22,
    'moradia':      0.09,
    'idade':        0.08,
    'afinidade_ia': 0.10,
}

assert abs(sum(PESOS.values()) - 1.0) < 1e-9, 'PESOS devem somar 1.0'

# Ordem fixa dos critérios (a soma ponderada segue esta ordem nas duas implementações).
CRITERIOS_ESTRUTURADOS: tuple[str, ...] = ('orcamento', 'regiao', 'rotina', 'habitos', 'moradia', 'idade')
CRITERIO_IA = 'afinidade_ia'

NOMES_CRITERIOS: dict[str, str] = {
    'orcamento':    'Orçamento',
    'regiao':       'Região',
    'rotina':       'Rotina',
    'habitos':      'Hábitos de convivência',
    'moradia':      'Estilo de moradia',
    'idade':        'Faixa etária',
    'afinidade_ia': 'Afinidade de perfil (IA)',
}

# ---------------------------------------------------------------------------
# Afinidade por IA — calibração do cosseno (tabela em docs/algoritmo-compatibilidade.md, seção 11.4)
# ---------------------------------------------------------------------------
# afinidade = (cosseno - PISO) / (TETO - PISO), limitada a [0, 1].
# Medido com o modelo paraphrase-multilingual-MiniLM-L12-v2 em 24 pares de frases e nas 104 combinações
# de bios do seed_demo: bios sem relação ficam entre 0,30 e 0,45 (afinidade ~0,25 a 0,55, perto do meio,
# para quem tem bio não sair perdendo de quem não tem); interesses iguais escritos com palavras
# diferentes, entre 0,47 e 0,76; temas opostos (festas × silêncio), abaixo de 0,25.
IA_COSSENO_PISO = 0.20
IA_COSSENO_TETO = 0.65
# O cosseno é arredondado nesta quantidade de casas antes da calibração (escalar e vetorial
# ficam idênticos mesmo quando o produto escalar do NumPy difere no último bit).
IA_CASAS_COSSENO = 4

# Temas de convivência (ia/temas.py): o texto "tem" o tema quando o cosseno com alguma frase do tema
# é >= LIMIAR_TEMA E fica pelo menos MARGEM_TEMA acima da média do texto em todos os temas
# (a margem descarta temas genéricos que "parecem" com qualquer bio). No máximo MAX_TEMAS por texto.
LIMIAR_TEMA = 0.45
MARGEM_TEMA = 0.13
MAX_TEMAS = 5

# Texto de origem do embedding: menos que isto (letras e dígitos) não gera embedding.
MIN_CARACTERES_TEXTO = 20

# ---------------------------------------------------------------------------
# Divisores para dimensões contínuas
# ---------------------------------------------------------------------------
DIV_ESCALA_5  = 4.0   # 1-5 → diff_max = 4
DIV_MORADORES = 3.0   # 1-4 → diff_max = 3
DIV_IDADE     = 20.0  # diferença >= 20 anos → sim = 0
N_HABITOS     = 6     # sub-dimensões que compõem sim_habitos

# ---------------------------------------------------------------------------
# Tabelas de similaridade (list[list[float]])
# Indexadas pelas constantes *_IDX abaixo.
# ---------------------------------------------------------------------------

# perfil_horario: madrugador=0, noturno=1, flexivel=2
HORARIO_IDX: dict[str, int] = {'madrugador': 0, 'noturno': 1, 'flexivel': 2}
HORARIO_MATRIX: list[list[float]] = [
    # madrugador  noturno  flexivel
    [1.0,         0.0,     0.6],   # madrugador
    [0.0,         1.0,     0.6],   # noturno
    [0.6,         0.6,     1.0],   # flexivel
]

# aceita_visitas: raramente=0, as_vezes=1, frequentemente=2
VISITAS_IDX: dict[str, int] = {'raramente': 0, 'as_vezes': 1, 'frequentemente': 2}
VISITAS_MATRIX: list[list[float]] = [
    # raramente  as_vezes  frequentemente
    [1.0,        0.5,      0.0],   # raramente
    [0.5,        1.0,      0.5],   # as_vezes
    [0.0,        0.5,      1.0],   # frequentemente
]

# tipo_imovel: apartamento=0, casa=1, republica=2, indiferente=3
IMOVEL_IDX: dict[str, int] = {
    'apartamento': 0,
    'casa':        1,
    'republica':   2,
    'indiferente': 3,
}
IMOVEL_MATRIX: list[list[float]] = [
    # apartamento  casa  republica  indiferente
    [1.0,          0.0,  0.0,       0.7],   # apartamento
    [0.0,          1.0,  0.0,       0.7],   # casa
    [0.0,          0.0,  1.0,       0.7],   # republica
    [0.7,          0.7,  0.7,       1.0],   # indiferente
]
