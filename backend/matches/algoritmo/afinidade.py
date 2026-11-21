"""
7º critério — Afinidade de interesses (IA) — e a combinação final dos critérios.

Usado por escalar.py e vetorial.py (as duas implementações chamam as MESMAS funções de calibração e de
combinação, então o resultado só pode divergir no produto escalar, que é arredondado em
IA_CASAS_COSSENO casas antes de seguir).

O vetor de cada perfil vem de:
  - atributo `vetor_ia` (np.ndarray normalizado ou None) — objetos leves (SimpleNamespace) e testes;
  - relação reversa `embedding_ia` (ia.EmbeddingPerfil) — Perfil do Django. Use
    select_related('embedding_ia') nas consultas em lote para não gerar N+1.
"""

from __future__ import annotations

import numpy as np
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist

from .config import (
    CRITERIO_IA,
    CRITERIOS_ESTRUTURADOS,
    IA_CASAS_COSSENO,
    IA_COSSENO_PISO,
    IA_COSSENO_TETO,
)


def ia_ligada() -> bool:
    """IA_HABILITADA (settings). Desligada, o 7º critério é sempre ignorado."""
    return bool(getattr(settings, 'IA_HABILITADA', True))


def vetor_do_perfil(perfil):
    """Vetor normalizado (float64, 384) do perfil, ou None (sem embedding, modelo antigo ou IA desligada)."""
    if not ia_ligada():
        return None
    if hasattr(perfil, 'vetor_ia'):
        return perfil.vetor_ia
    try:
        emb = perfil.embedding_ia
    except (ObjectDoesNotExist, AttributeError):
        return None
    return emb.vetor_valido() if emb is not None else None


def temas_do_perfil(perfil) -> list[str]:
    """Ids dos temas detectados na bio (lista vazia sem embedding ou com a IA desligada)."""
    if not ia_ligada():
        return []
    if hasattr(perfil, 'temas_ia'):
        return list(perfil.temas_ia or [])
    try:
        emb = perfil.embedding_ia
    except (ObjectDoesNotExist, AttributeError):
        return []
    if emb is None or emb.vetor_valido() is None:
        return []
    return list(emb.temas or [])


def arredondar_cosseno(valor: float) -> float:
    return round(float(valor), IA_CASAS_COSSENO)


def cosseno(va, vb) -> float | None:
    """Cosseno entre dois vetores normalizados (None se faltar algum)."""
    if va is None or vb is None:
        return None
    return arredondar_cosseno(np.dot(va, vb))


def calibrar(cos: float | None) -> float | None:
    """Converte o cosseno em afinidade 0..1 (escala linear limitada entre o piso e o teto)."""
    if cos is None:
        return None
    x = (cos - IA_COSSENO_PISO) / (IA_COSSENO_TETO - IA_COSSENO_PISO)
    return round(max(0.0, min(1.0, x)), 4)


def pesos_efetivos(pesos: dict, com_ia: bool) -> dict[str, float]:
    """Peso de cada critério depois da renormalização (somam 1.0)."""
    usados = list(CRITERIOS_ESTRUTURADOS) + ([CRITERIO_IA] if com_ia else [])
    total = sum(pesos.get(k, 0.0) for k in usados)
    return {k: (pesos.get(k, 0.0) / total if (k in usados and total > 0) else 0.0)
            for k in list(CRITERIOS_ESTRUTURADOS) + [CRITERIO_IA]}


def combinar(sims: tuple, sim_ia: float | None, pesos: dict) -> float:
    """
    Soma ponderada dos 6 critérios estruturados (+ afinidade IA, quando houver), em float Python e
    sempre na mesma ordem. Sem afinidade, divide pela soma dos 6 pesos (renormalização).
    """
    soma = 0.0
    total = 0.0
    for chave, valor in zip(CRITERIOS_ESTRUTURADOS, sims):
        peso = pesos[chave]
        soma += peso * valor
        total += peso
    if sim_ia is not None:
        peso = pesos.get(CRITERIO_IA, 0.0)
        soma += peso * sim_ia
        total += peso
    bruto = soma / total if total > 0 else 0.0
    return round(max(0.0, min(1.0, bruto)), 4)
