from django.db import models
from django.conf import settings
from django.db.models import CheckConstraint, F, Q
from django.db.models.functions import Length
from django.db.models.lookups import LessThanOrEqual


class Denuncia(models.Model):
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('resolvida', 'Resolvida'),
        ('descartada', 'Descartada'),
    ]
    MOTIVO_CHOICES = [
        ('spam', 'Spam'),
        ('ofensivo', 'Conteúdo ofensivo'),
        ('falso', 'Perfil falso'),
        ('outro', 'Outro'),
    ]

    denunciante = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='denuncias_feitas',
    )
    denunciado = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='denuncias_recebidas',
    )
    motivo = models.CharField(max_length=20, choices=MOTIVO_CHOICES)
    descricao = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pendente', db_index=True
    )
    resolvida_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='denuncias_resolvidas',
    )
    resolucao = models.TextField(blank=True, default='')
    criada_em = models.DateTimeField(auto_now_add=True, db_index=True)
    atualizada_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-criada_em']
        indexes = [
            models.Index(fields=['status', 'criada_em']),
            models.Index(fields=['denunciado', 'status']),
        ]
        constraints = [
            CheckConstraint(condition=Q(motivo__in=['spam', 'ofensivo', 'falso', 'outro']), name='denuncia_motivo_valido_ck'),
            CheckConstraint(condition=Q(status__in=['pendente', 'resolvida', 'descartada']), name='denuncia_status_valido_ck'),
            CheckConstraint(condition=LessThanOrEqual(Length('descricao'), 500), name='denuncia_descricao_max_500_ck'),
            CheckConstraint(condition=LessThanOrEqual(Length('resolucao'), 500), name='denuncia_resolucao_max_500_ck'),
            CheckConstraint(condition=~Q(denunciante=F('denunciado')), name='denuncia_nao_a_si_mesmo_ck'),
        ]

    def __str__(self):
        return f'Denuncia {self.id} - {self.denunciante} -> {self.denunciado} [{self.status}]'
