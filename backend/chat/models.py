from django.db import models


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

    def __str__(self):
        return f'[{self.match_id}] {self.remetente}: {self.conteudo[:40]}'
