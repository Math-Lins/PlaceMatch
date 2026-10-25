import os
import secrets
import string

from django.core.management.base import BaseCommand
from usuarios.models import Usuario


def _gerar_senha(tamanho=16):
    alfabeto = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alfabeto) for _ in range(tamanho))


class Command(BaseCommand):
    help = 'Cria (ou atualiza) o usuário administrador padrão do sistema.'

    def handle(self, *args, **options):
        email = os.environ.get('ADMIN_EMAIL', 'admin@placematch.com')
        senha = os.environ.get('ADMIN_SENHA', '')
        senha_gerada = False

        if not senha:
            senha = _gerar_senha()
            senha_gerada = True

        usuario, criado = Usuario.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'tipo': 'administrador',
                'is_staff': True,
            },
        )

        if not criado:
            # Garante que um admin existente mantém tipo e is_staff corretos
            atualizado = False
            if usuario.tipo != 'administrador':
                usuario.tipo = 'administrador'
                atualizado = True
            if not usuario.is_staff:
                usuario.is_staff = True
                atualizado = True
            if atualizado:
                usuario.save(update_fields=['tipo', 'is_staff'])

        usuario.set_password(senha)
        usuario.save(update_fields=['password'])

        acao = 'Criado' if criado else 'Atualizado'
        self.stdout.write(self.style.SUCCESS(f'{acao}: {email}'))

        if senha_gerada:
            self.stdout.write(f'Senha gerada: {senha}')
