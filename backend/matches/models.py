from django.db import models
from perfis.models import Perfil


class Compatibilidade(models.Model):
    perfil_a = models.ForeignKey(
        Perfil,
        on_delete=models.CASCADE,
        related_name='compatibilidades_como_a',
    )
    perfil_b = models.ForeignKey(
        Perfil,
        on_delete=models.CASCADE,
        related_name='compatibilidades_como_b',
    )
    score = models.FloatField()
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('perfil_a', 'perfil_b')

    def __str__(self):
        return f'{self.perfil_a} <-> {self.perfil_b}: {self.score:.2f}'


class Curtida(models.Model):
    TIPO_CHOICES = [
        ('curtir', 'Curtir'),
        ('recusar', 'Recusar'),
    ]

    perfil_origem = models.ForeignKey(
        Perfil,
        on_delete=models.CASCADE,
        related_name='curtidas_enviadas',
    )
    perfil_destino = models.ForeignKey(
        Perfil,
        on_delete=models.CASCADE,
        related_name='curtidas_recebidas',
    )
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    data = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('perfil_origem', 'perfil_destino')

    def __str__(self):
        return f'{self.perfil_origem} {self.tipo} {self.perfil_destino}'


class Match(models.Model):
    perfil_a = models.ForeignKey(
        Perfil,
        on_delete=models.CASCADE,
        related_name='matches_como_a',
    )
    perfil_b = models.ForeignKey(
        Perfil,
        on_delete=models.CASCADE,
        related_name='matches_como_b',
    )
    score = models.FloatField()
    data_match = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('perfil_a', 'perfil_b')

    def __str__(self):
        return f'Match: {self.perfil_a} <-> {self.perfil_b}'
