from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Perfil(models.Model):
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='perfil',
    )
    nome = models.CharField(max_length=150)
    idade = models.PositiveIntegerField()
    regiao = models.CharField(max_length=200)
    bio = models.TextField(blank=True, default='')
    orcamento_min = models.DecimalField(max_digits=10, decimal_places=2)
    orcamento_max = models.DecimalField(max_digits=10, decimal_places=2)
    fumante = models.BooleanField(default=False)
    aceita_pets = models.BooleanField(default=False)
    tolerancia_bagunca = models.IntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    nivel_organizacao = models.IntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.nome} ({self.usuario.email})'
