from django.db import models
from django.conf import settings


class LogOperacao(models.Model):
    ACAO_CHOICES = [
        ('LOGIN', 'Login'),
        ('LOGIN_FALHA', 'Login com falha'),
        ('CADASTRO', 'Cadastro'),
        ('PERFIL_CRIADO', 'Perfil criado'),
        ('PERFIL_EDITADO', 'Perfil editado'),
        ('PERFIL_EXCLUIDO', 'Perfil excluído'),
        ('CURTIDA', 'Curtida'),
        ('RECUSA', 'Recusa'),
        ('MATCH_CRIADO', 'Match criado'),
        ('MENSAGEM_ENVIADA', 'Mensagem enviada'),
        ('RELATORIO_EXPORTADO', 'Relatório exportado'),
        ('DENUNCIA_CRIADA', 'Denúncia criada'),
        ('DENUNCIA_RESOLVIDA', 'Denúncia resolvida'),
        ('USUARIO_SUSPENSO', 'Usuário suspenso'),
        ('USUARIO_REATIVADO', 'Usuário reativado'),
        ('SENHA_SOLICITADA', 'Redefinição de senha solicitada'),
        ('SENHA_REDEFINIDA', 'Senha redefinida'),
        ('IA_TESTE', 'Teste da IA (painel)'),
    ]
    # Rótulo EXIBIDO (API e CSV) quando difere do rótulo das choices: trocar o texto das choices exigiria uma
    # migração só por causa do nome. O código gravado (IA_TESTE) não muda.
    ROTULO_EXIBIDO = {'IA_TESTE': 'Teste do ThoLuk (painel)'}

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs',
    )
    acao = models.CharField(max_length=30, choices=ACAO_CHOICES)
    entidade = models.CharField(max_length=100, blank=True, default='')
    entidade_id = models.BigIntegerField(null=True, blank=True)
    detalhes = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    data_hora = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-data_hora', '-id']
        indexes = [
            models.Index(fields=['acao', 'data_hora']),
            models.Index(fields=['usuario', 'data_hora']),
        ]

    def rotulo_acao(self) -> str:
        return self.ROTULO_EXIBIDO.get(self.acao) or self.get_acao_display()

    def __str__(self):
        return f'{self.acao} - {self.usuario} - {self.data_hora}'
