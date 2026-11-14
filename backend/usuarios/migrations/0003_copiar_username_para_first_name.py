"""Migração de dados: o nome digitado no cadastro estava em `username`.

Copia o username atual para `first_name` quando o nome ainda está vazio, para que
/api/auth/me/, painel de usuários, logs, relatórios e CSVs continuem exibindo o nome.
Não copia quando o username é um e-mail (ex.: administrador criado por `criar_admin`),
e remove a marca interna de seeds (`__seed__`).
"""
from django.db import migrations

SEED_TAG = '__seed__'


def copiar(apps, schema_editor):
    Usuario = apps.get_model('usuarios', 'Usuario')
    for u in Usuario.objects.filter(first_name=''):
        nome = (u.username or '').replace(SEED_TAG, '').strip()
        if not nome or '@' in nome:
            continue
        u.first_name = nome[:150]
        u.save(update_fields=['first_name'])


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0002_manager_email_iexact'),
    ]

    operations = [
        migrations.RunPython(copiar, migrations.RunPython.noop),
    ]
