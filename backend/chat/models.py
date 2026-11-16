from django.db import models
from django.db.models import CheckConstraint
from django.db.models.functions import Length
from django.db.models.lookups import GreaterThanOrEqual, LessThanOrEqual


class Mensagem(models.Model):
    match = models.ForeignKey(
        'matches.Match',
        on_delete=models.CASCADE,
        related_name='mensagens',
    )
    remetente = models.ForeignKey(
        'perfis.Perfil',
        on_delete=models.CASCADE,
    )
    conteudo = models.TextField()
    data_envio = models.DateTimeField(auto_now_add=True)
    lida = models.BooleanField(default=False)

    class Meta:
        ordering = ['data_envio', 'id']
        indexes = [
            models.Index(fields=['match', 'data_envio']),
        ]
        constraints = [
            CheckConstraint(condition=GreaterThanOrEqual(Length('conteudo'), 1), name='mensagem_conteudo_min_1_ck'),
            CheckConstraint(condition=LessThanOrEqual(Length('conteudo'), 1000), name='mensagem_conteudo_max_1000_ck'),
        ]

    def __str__(self):
        return f'[{self.match_id}] {self.remetente}: {self.conteudo[:40]}'
