"""
python manage.py recalcular_compatibilidades [--metodo lote|loop]

Recalcula todos os scores de compatibilidade entre perfis buscando_vaga e
oferecendo_vaga.

Flags:
  --metodo lote  (padrão) NumPy + bulk_create upsert — O(1) queries por perfil
  --metodo loop  update_or_create escalar — linha de base para comparação
"""

import time
from django.core.management.base import BaseCommand
from perfis.models import Perfil
from matches.servicos import recalcular_lote, recalcular_loop


class Command(BaseCommand):
    help = 'Recalcula todas as compatibilidades entre perfis.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--metodo',
            choices=['lote', 'loop'],
            default='lote',
            help='Algoritmo de recálculo: lote (NumPy, padrão) ou loop (escalar).',
        )

    def handle(self, *args, **options):
        metodo = options['metodo']
        fn = recalcular_lote if metodo == 'lote' else recalcular_loop

        buscando = list(
            Perfil.objects
            .filter(usuario__tipo='buscando_vaga')
            .select_related('usuario')
        )

        self.stdout.write(
            f'Método: {metodo} | '
            f'Recalculando compatibilidades para {len(buscando)} perfis buscando_vaga…'
        )

        inicio = time.perf_counter()
        for i, perfil in enumerate(buscando, 1):
            fn(perfil)
            if i % 10 == 0 or i == len(buscando):
                self.stdout.write(f'  {i}/{len(buscando)} processados')

        elapsed = time.perf_counter() - inicio
        self.stdout.write(self.style.SUCCESS(
            f'Concluído em {elapsed:.2f}s.'
        ))
