from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Perfil(models.Model):
    HORARIO_CHOICES = [
        ('madrugador', 'Madrugador (acorda cedo)'),
        ('noturno', 'Noturno (dorme/acorda tarde)'),
        ('flexivel', 'Flexível'),
    ]

    VISITAS_CHOICES = [
        ('raramente', 'Raramente'),
        ('as_vezes', 'Às vezes'),
        ('frequentemente', 'Frequentemente'),
    ]

    IMOVEL_CHOICES = [
        ('apartamento', 'Apartamento'),
        ('casa', 'Casa'),
        ('republica', 'República'),
        ('indiferente', 'Indiferente'),
    ]

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
    # ── Novos campos (Sprint 6) ──────────────────────────────────────────────
    perfil_horario = models.CharField(
        max_length=20, choices=HORARIO_CHOICES, default='flexivel',
    )
    nivel_ruido = models.IntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    nivel_social = models.IntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    aceita_visitas = models.CharField(
        max_length=20, choices=VISITAS_CHOICES, default='as_vezes',
    )
    tipo_imovel = models.CharField(
        max_length=20, choices=IMOVEL_CHOICES, default='indiferente',
    )
    qtd_moradores = models.IntegerField(
        default=2,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
    )
    # ── Anúncio / foto (Sprint D) ─────────────────────────────────────────────
    titulo_anuncio = models.CharField(max_length=120, blank=True, default='')
    descricao_imovel = models.TextField(blank=True, default='')
    fotos_imovel = models.JSONField(default=list, blank=True)
    foto_perfil_url = models.URLField(max_length=500, blank=True, default='')
    # ────────────────────────────────────────────────────────────────────────
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.nome} ({self.usuario.email})'
