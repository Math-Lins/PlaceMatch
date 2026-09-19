from django.contrib.auth.models import AbstractUser
from django.db import models


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

    def __str__(self):
        return self.email
