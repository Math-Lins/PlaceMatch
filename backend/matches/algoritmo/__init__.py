"""
matches.algoritmo — pacote de compatibilidade entre perfis.

Exports públicos:
  calcular_score(a, b) -> float
  calcular_scores_lote(base, outros) -> (ids: np.ndarray, scores: np.ndarray)
  detalhar_score(a, b) -> dict (valor de cada critério)
  PESOS: dict[str, float]

Os exports são carregados sob demanda (PEP 562): os workers de processo do recálculo em paralelo importam
só matriz.py/paralelo.py e não pagam o import do Django (escalar/vetorial usam django.conf), ~0,5 s a menos
na subida de cada worker.
"""

from importlib import import_module

_ORIGEM = {
    'PESOS': 'config',
    'calcular_score': 'escalar',
    'detalhar_score': 'escalar',
    '_sim_horario': 'escalar',
    '_sim_visitas': 'escalar',
    '_sim_imovel': 'escalar',
    'calcular_scores_lote': 'vetorial',
}

__all__ = [
    'PESOS',
    'calcular_score',
    'detalhar_score',
    'calcular_scores_lote',
    '_sim_horario',
    '_sim_visitas',
    '_sim_imovel',
]


def __getattr__(nome):
    if nome in _ORIGEM:
        valor = getattr(import_module(f'{__name__}.{_ORIGEM[nome]}'), nome)
        globals()[nome] = valor
        return valor
    raise AttributeError(f'module {__name__!r} has no attribute {nome!r}')
