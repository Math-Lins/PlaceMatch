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
        .select_related('usuario')
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

    Faz apenas 2 queries ao banco (buscar opostos + upsert em batch),
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
        .select_related('usuario')
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
