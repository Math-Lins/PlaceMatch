"""
matches.algoritmo — pacote de compatibilidade entre perfis.

Exports públicos:
  calcular_score(a, b) -> float
  calcular_scores_lote(base, outros) -> (ids: np.ndarray, scores: np.ndarray)
  PESOS: dict[str, float]
"""

from .config import PESOS
from .escalar import calcular_score, _sim_horario, _sim_visitas, _sim_imovel
from .vetorial import calcular_scores_lote

__all__ = [
    'PESOS',
    'calcular_score',
    'calcular_scores_lote',
    '_sim_horario',
    '_sim_visitas',
    '_sim_imovel',
]
