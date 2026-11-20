from django.db.models.signals import post_save
from django.dispatch import receiver
from perfis.models import Perfil
from .servicos import recalcular_lote


@receiver(post_save, sender=Perfil)
def recalcular_compatibilidade(sender, instance, **kwargs):
    """
    Quando um Perfil é criado ou atualizado:
      1. gera/atualiza o embedding da bio (Afinidade por IA) — só se o texto mudou; nunca levanta exceção;
      2. recalcula a Compatibilidade entre ele e todos os perfis de tipo oposto em lote (NumPy + bulk_create).
    """
    from ia.embeddings import atualizar_embedding_perfil
    atualizar_embedding_perfil(instance)
    recalcular_lote(instance)
