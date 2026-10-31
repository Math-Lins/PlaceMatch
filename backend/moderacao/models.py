from django.db import models
from django.conf import settings


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

    def __str__(self):
        return f'Denuncia {self.id} - {self.denunciante} -> {self.denunciado} [{self.status}]'
