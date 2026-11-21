"""
Afinidade por IA vista pela API: afinidade calibrada e temas em comum entre o usuário e outros perfis.

Os vetores e os temas vêm do EmbeddingPerfil (pré-calculado no signal). Nada aqui chama o modelo:
a Descoberta, o detalhe do perfil e GET /api/compatibilidade/{id}/ funcionam mesmo com o modelo fora do ar.
Para não gerar N+1, busque os perfis com select_related('embedding_ia').
"""

from __future__ import annotations

import numpy as np

from matches.algoritmo.afinidade import (
    arredondar_cosseno, calibrar, cosseno, temas_do_perfil, vetor_do_perfil,
)

from .temas import nomes


def temas_em_comum(temas_a, temas_b) -> list[dict]:
    return nomes(set(temas_a or []) & set(temas_b or []))


def afinidades_para(meu_perfil, outros) -> dict[int, dict]:
    """{perfil_id: {'afinidade_ia': 0..1 | None, 'temas_em_comum': [{'id', 'nome'}]}} — um produto matricial."""
    outros = list(outros)
    saida = {p.id: {'afinidade_ia': None, 'temas_em_comum': []} for p in outros}
    if meu_perfil is None or not outros:
        return saida
    va = vetor_do_perfil(meu_perfil)
    if va is None:
        return saida
    meus_temas = temas_do_perfil(meu_perfil)
    com_vetor = [(p, v) for p in outros if (v := vetor_do_perfil(p)) is not None]
    if not com_vetor:
        return saida
    cossenos = np.vstack([v for _, v in com_vetor]) @ va
    for (p, _), c in zip(com_vetor, cossenos.tolist()):
        saida[p.id] = {
            'afinidade_ia': calibrar(arredondar_cosseno(c)),
            'temas_em_comum': temas_em_comum(meus_temas, temas_do_perfil(p)),
        }
    return saida


def explicar_par(perfil_a, perfil_b) -> dict:
    """Cosseno, afinidade e temas (de cada um e em comum) entre dois perfis."""
    va, vb = vetor_do_perfil(perfil_a), vetor_do_perfil(perfil_b)
    cos = cosseno(va, vb)
    temas_a, temas_b = temas_do_perfil(perfil_a), temas_do_perfil(perfil_b)
    return {
        'cosseno': cos,
        'afinidade_ia': calibrar(cos),
        'tem_vetor_a': va is not None,
        'tem_vetor_b': vb is not None,
        'temas_a': nomes(temas_a),
        'temas_b': nomes(temas_b),
        'temas_em_comum': temas_em_comum(temas_a, temas_b) if cos is not None else [],
    }


def analise_do_perfil(perfil) -> dict:
    """O que a IA entendeu da bio do próprio usuário (campo `analise_ia` do perfil). Não chama o modelo."""
    from matches.algoritmo.afinidade import ia_ligada
    from matches.algoritmo.config import MIN_CARACTERES_TEXTO

    from . import servico

    uteis = servico.caracteres_uteis(servico.texto_do_perfil(perfil))
    base = {'temas': [], 'caracteres_uteis': uteis, 'minimo_caracteres': MIN_CARACTERES_TEXTO}
    if not ia_ligada():
        return {'situacao': 'ia_desligada', **base}
    if uteis < MIN_CARACTERES_TEXTO:
        return {'situacao': 'bio_curta', **base}
    if vetor_do_perfil(perfil) is None:
        return {'situacao': 'pendente', **base}
    return {'situacao': 'analisada', **base, 'temas': nomes(temas_do_perfil(perfil))}
