import hashlib

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class UsuarioManager(UserManager):
    def get_by_natural_key(self, username):
        """Login pelo e-mail sem diferenciar maiúsculas de minúsculas."""
        campo = self.model.USERNAME_FIELD
        try:
            return self.get(**{campo: username})
        except self.model.DoesNotExist:
            pass
        try:
            return self.get(**{f'{campo}__iexact': username})
        except self.model.MultipleObjectsReturned:
            raise self.model.DoesNotExist()


class Usuario(AbstractUser):
    TIPO_CHOICES = [
        ('buscando_vaga', 'Buscando Vaga'),
        ('oferecendo_vaga', 'Oferecendo Vaga'),
        ('administrador', 'Administrador'),
    ]

    email = models.EmailField(unique=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='buscando_vaga')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = UsuarioManager()

    def __str__(self):
        return self.email

    @property
    def nome_exibicao(self):
        return self.first_name or self.username


def gerar_username(email):
    """Username único derivado do e-mail (o nome real fica em `first_name`)."""
    base = (email or '').strip().lower()
    if len(base) > 150:
        base = base[:141] + '-' + hashlib.sha1(base.encode()).hexdigest()[:8]
    candidato, n = base, 1
    while Usuario.objects.filter(username__iexact=candidato).exists():
        n += 1
        sufixo = f'-{n}'
        candidato = base[:150 - len(sufixo)] + sufixo
    return candidato
