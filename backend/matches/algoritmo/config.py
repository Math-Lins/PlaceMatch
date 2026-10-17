"""
Única fonte de verdade para pesos e tabelas de similaridade.

Toda mudança de peso ou de regra deve acontecer AQUI — escalar.py e
vetorial.py apenas lêem estas constantes.
"""

# ---------------------------------------------------------------------------
# Pesos do score final (devem somar 1.0)
# ---------------------------------------------------------------------------
PESOS: dict[str, float] = {
    'orcamento': 0.20,
    'regiao':    0.10,
    'rotina':    0.15,
    'habitos':   0.25,
    'moradia':   0.10,
    'idade':     0.20,
}

assert abs(sum(PESOS.values()) - 1.0) < 1e-9, 'PESOS devem somar 1.0'

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
