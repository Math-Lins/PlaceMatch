"""
Camada de serviço para recálculo de compatibilidade.

recalcular_lote  — usa NumPy + bulk_create para O(n) queries.
recalcular_loop  — implementação escalar original (referência / fallback).
"""

from django.utils import timezone
from perfis.models import Perfil
from .models import Compatibilidade
from .algoritmo import calcular_score, calcular_scores_lote


def recalcular_loop(instance: Perfil) -> None:
    """Recalcula compatibilidades usando um loop Python + update_or_create."""
    meu_tipo = instance.usuario.tipo
    if meu_tipo not in ('buscando_vaga', 'oferecendo_vaga'):
        return

    tipo_oposto = 'oferecendo_vaga' if meu_tipo == 'buscando_vaga' else 'buscando_vaga'
    perfis_opostos = (
        Perfil.objects
        .filter(usuario__tipo=tipo_oposto)
        .exclude(id=instance.id)
        .select_related('usuario', 'embedding_ia')  # embedding: 7º critério, sem N+1
    )

    for outro in perfis_opostos:
        pa_id = min(instance.id, outro.id)
        pb_id = max(instance.id, outro.id)
        pa = instance if instance.id == pa_id else outro
        pb = outro   if outro.id   == pb_id else instance

        score = calcular_score(pa, pb)
        Compatibilidade.objects.update_or_create(
            perfil_a_id=pa_id,
            perfil_b_id=pb_id,
            defaults={'score': score},
        )


def recalcular_lote(instance: Perfil) -> None:
    """
    Recalcula compatibilidades em lote via NumPy + bulk_create (upsert).

    Faz apenas 2 queries ao banco (buscar opostos com os embeddings + upsert em batch),
    independentemente do número de perfis.
    """
    meu_tipo = instance.usuario.tipo
    if meu_tipo not in ('buscando_vaga', 'oferecendo_vaga'):
        return

    tipo_oposto = 'oferecendo_vaga' if meu_tipo == 'buscando_vaga' else 'buscando_vaga'
    perfis_opostos = list(
        Perfil.objects
        .filter(usuario__tipo=tipo_oposto)
        .exclude(id=instance.id)
        .select_related('usuario', 'embedding_ia')  # embedding: 7º critério, sem N+1
    )

    if not perfis_opostos:
        return

    ids, scores = calcular_scores_lote(instance, perfis_opostos)

    agora = timezone.now()

    objetos = []
    for outro_id, score in zip(ids.tolist(), scores.tolist()):
        pa_id = min(instance.id, int(outro_id))
        pb_id = max(instance.id, int(outro_id))
        objetos.append(Compatibilidade(
            perfil_a_id=pa_id,
            perfil_b_id=pb_id,
            score=round(score, 4),
            atualizado_em=agora,
        ))

    Compatibilidade.objects.bulk_create(
        objetos,
        update_conflicts=True,
        unique_fields=['perfil_a', 'perfil_b'],
        update_fields=['score', 'atualizado_em'],
        batch_size=1000,
    )


def detalhar_compatibilidade(meu_perfil: Perfil, outro: Perfil) -> dict:
    """
    Score e detalhamento por critério entre o usuário e outro perfil (GET /api/compatibilidade/{id}/).

    Usa o mesmo cálculo gravado em Compatibilidade (perfil de menor id como `a`); peso_efetivo já vem
    renormalizado quando a afinidade por IA não entra, e a soma das contribuições é o score.
    """
    from ia import servico
    from ia.explicacao import explicar_par
    from .algoritmo import PESOS, detalhar_score
    from .algoritmo.afinidade import pesos_efetivos
    from .algoritmo.config import CRITERIO_IA, CRITERIOS_ESTRUTURADOS, NOMES_CRITERIOS

    pa, pb = (meu_perfil, outro) if meu_perfil.id < outro.id else (outro, meu_perfil)
    det = detalhar_score(pa, pb)
    com_ia = det['afinidade_ia'] is not None
    efetivos = pesos_efetivos(PESOS, com_ia)
    valores = dict(det['criterios'], **{CRITERIO_IA: det['afinidade_ia']})
    criterios = []
    for chave in list(CRITERIOS_ESTRUTURADOS) + [CRITERIO_IA]:
        valor = valores[chave]
        criterios.append({
            'criterio': chave,
            'nome': NOMES_CRITERIOS[chave],
            'peso': PESOS[chave],
            'peso_efetivo': round(efetivos[chave], 4),
            'valor': round(valor, 4) if valor is not None else None,
            'contribuicao': round(efetivos[chave] * valor, 4) if valor is not None else 0.0,
            'considerado': valor is not None,
        })

    par = explicar_par(meu_perfil, outro)
    motivo = None
    if not com_ia:
        if not servico.habilitada():
            motivo = 'A Afinidade por IA está desligada neste servidor; o score usa os outros 6 critérios.'
        elif not par['tem_vetor_a']:
            motivo = ('Seu perfil ainda não tem análise de IA (bio com menos de 20 letras ou IA indisponível '
                      'quando a bio foi salva); o score usa os outros 6 critérios.')
        else:
            motivo = 'Este perfil ainda não tem análise de IA (bio muito curta); o score usa os outros 6 critérios.'
    return {
        'perfil_id': outro.id,
        'nome': outro.nome,
        'score': det['score'],
        'criterios': criterios,
        'afinidade_ia': det['afinidade_ia'],
        'similaridade_ia': det['cosseno'],
        'temas_em_comum': par['temas_em_comum'],
        'temas_meu_perfil': par['temas_a'],
        'temas_outro_perfil': par['temas_b'],
        'ia_disponivel': servico.disponivel(),
        'motivo_sem_ia': motivo,
    }
