from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import CheckConstraint, F, Q
from django.db.models.functions import Length
from django.db.models.lookups import GreaterThanOrEqual, LessThanOrEqual


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

    class Meta:
        # Regras de negócio protegidas também no banco (além da validação da API).
        # Os valores de choices abaixo espelham HORARIO_/VISITAS_/IMOVEL_CHOICES.
        constraints = [
            CheckConstraint(condition=Q(idade__gte=18, idade__lte=100), name='perfil_idade_18_100_ck'),
            CheckConstraint(condition=Q(orcamento_min__gt=0), name='perfil_orcamento_min_positivo_ck'),
            CheckConstraint(condition=Q(orcamento_min__lte=F('orcamento_max')), name='perfil_orcamento_min_lte_max_ck'),
            CheckConstraint(condition=Q(qtd_moradores__gte=1, qtd_moradores__lte=4), name='perfil_moradores_1_4_ck'),
            CheckConstraint(condition=Q(tolerancia_bagunca__gte=1, tolerancia_bagunca__lte=5), name='perfil_bagunca_1_5_ck'),
            CheckConstraint(condition=Q(nivel_organizacao__gte=1, nivel_organizacao__lte=5), name='perfil_organizacao_1_5_ck'),
            CheckConstraint(condition=Q(nivel_ruido__gte=1, nivel_ruido__lte=5), name='perfil_ruido_1_5_ck'),
            CheckConstraint(condition=Q(nivel_social__gte=1, nivel_social__lte=5), name='perfil_social_1_5_ck'),
            CheckConstraint(condition=Q(perfil_horario__in=['madrugador', 'noturno', 'flexivel']), name='perfil_horario_valido_ck'),
            CheckConstraint(condition=Q(aceita_visitas__in=['raramente', 'as_vezes', 'frequentemente']), name='perfil_visitas_valido_ck'),
            CheckConstraint(condition=Q(tipo_imovel__in=['apartamento', 'casa', 'republica', 'indiferente']), name='perfil_imovel_valido_ck'),
            CheckConstraint(condition=GreaterThanOrEqual(Length('nome'), 2), name='perfil_nome_min_2_ck'),
            CheckConstraint(condition=LessThanOrEqual(Length('bio'), 500), name='perfil_bio_max_500_ck'),
            CheckConstraint(condition=LessThanOrEqual(Length('descricao_imovel'), 1000), name='perfil_descricao_max_1000_ck'),
        ]

    def __str__(self):
        return f'{self.nome} ({self.usuario.email})'
