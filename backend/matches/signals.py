from django.db.models.signals import post_save
from django.dispatch import receiver
from perfis.models import Perfil
from .models import Compatibilidade
from .compatibilidade import calcular_score


@receiver(post_save, sender=Perfil)
def recalcular_compatibilidade(sender, instance, **kwargs):
    """
    Quando um Perfil é criado ou atualizado, recalcula a Compatibilidade
    entre ele e todos os perfis de tipo oposto existentes.

    PONTO DE OTIMIZAÇÃO FUTURA: o loop simples abaixo é O(n) em relação ao
    número de perfis do tipo oposto. Para grandes volumes, considerar
    processamento assíncrono com Celery ou cálculo em batch com NumPy.
    """
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
        pb = outro if outro.id == pb_id else instance

        score = calcular_score(pa, pb)
        Compatibilidade.objects.update_or_create(
            perfil_a_id=pa_id,
            perfil_b_id=pb_id,
            defaults={'score': score},
        )
