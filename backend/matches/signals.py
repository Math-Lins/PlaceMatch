from django.db.models.signals import post_save
from django.dispatch import receiver
from perfis.models import Perfil
from .servicos import recalcular_lote


@receiver(post_save, sender=Perfil)
def recalcular_compatibilidade(sender, instance, **kwargs):
    """
    Quando um Perfil é criado ou atualizado, recalcula a Compatibilidade
    entre ele e todos os perfis de tipo oposto em lote (NumPy + bulk_create).
    """
    recalcular_lote(instance)
