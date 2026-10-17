"""
Fachada de compatibilidade — mantida para compatibilidade de imports.

Todo o código real está em matches.algoritmo.
"""

from .algoritmo import (  # noqa: F401
    calcular_score,
    _sim_horario,
    _sim_visitas,
    _sim_imovel,
)
