"""
python manage.py recalcular_compatibilidades

Recalcula todos os scores de compatibilidade entre perfis buscando_vaga e
oferecendo_vaga, usando o algoritmo vetorial (NumPy + bulk_create upsert).

Útil após mudança de pesos ou migração de dados.
"""

from django.core.management.base import BaseCommand
from perfis.models import Perfil
from matches.servicos import recalcular_lote


class Command(BaseCommand):
    help = 'Recalcula todas as compatibilidades entre perfis (vetorial).'

    def handle(self, *args, **options):
        buscando = list(
            Perfil.objects
            .filter(usuario__tipo='buscando_vaga')
            .select_related('usuario')
        )

        self.stdout.write(
            f'Recalculando compatibilidades para {len(buscando)} perfis buscando_vaga…'
        )

        for i, perfil in enumerate(buscando, 1):
            recalcular_lote(perfil)
            if i % 10 == 0 or i == len(buscando):
                self.stdout.write(f'  {i}/{len(buscando)} processados')

        self.stdout.write(self.style.SUCCESS('Concluído.'))
