"""
python manage.py recalcular_compatibilidades [--modo auto|processos|threads|sequencial] [--workers N] [--metodo lote|loop]

Recalcula os scores de compatibilidade de TODOS os pares buscando_vaga × oferecendo_vaga.

  --metodo lote  (padrão) carrega todos os perfis e embeddings UMA vez em arrays NumPy, calcula a matriz de
                 scores em blocos (em paralelo, veja --modo) e grava tudo com bulk_create em uma transação
                 (matches/processamento.py).
  --metodo loop  update_or_create escalar, um par por vez — linha de base para comparação (ignora --modo).

  --modo     auto (padrão): threads a partir de 1 milhão de pares (LIMIAR_PARES_PARALELO), senão sequencial
             (medido no benchmark_paralelismo). processos | threads | sequencial forçam o modo.
  --workers  número de workers (padrão: PROCESSAMENTO_WORKERS, que por padrão é min(4, núcleos)).

Se o pool de processos/threads falhar, o cálculo é refeito no modo sequencial (aviso no log).
"""

from django.core.management.base import BaseCommand, CommandError

from matches import processamento
from matches.algoritmo import paralelo


class Command(BaseCommand):
    help = 'Recalcula todas as compatibilidades entre perfis (em paralelo, em blocos).'

    def add_arguments(self, parser):
        parser.add_argument('--metodo', choices=['lote', 'loop'], default='lote',
                            help='lote (matriz NumPy em blocos, padrão) ou loop (escalar, linha de base).')
        parser.add_argument('--modo', choices=processamento.MODOS_COMANDO, default='auto',
                            help='auto (padrão), processos, threads ou sequencial.')
        parser.add_argument('--workers', type=int, default=None,
                            help=f'workers do pool (1 a {paralelo.MAX_WORKERS}; padrão: PROCESSAMENTO_WORKERS = '
                                 f'{processamento.workers_padrao()} nesta máquina).')

    def handle(self, *args, **options):
        workers = options['workers']
        if workers is not None and not 1 <= workers <= paralelo.MAX_WORKERS:
            raise CommandError(f'--workers deve ser um número entre 1 e {paralelo.MAX_WORKERS} (recebido: {workers}).')
        if options['metodo'] == 'loop':
            return self._loop()

        self.stdout.write('Recalculando compatibilidades (todos os pares buscando × oferecendo)…')
        r = processamento.recalcular_todas(options['modo'], workers)
        if r['aviso']:
            self.stderr.write(self.style.WARNING(f"Aviso: {r['aviso']}"))
        self.stdout.write(
            f"  {r['buscando']} buscando × {r['oferecendo']} oferecendo = {r['pares']} pares | "
            f"modo {r['modo']} ({r['workers']} worker{'s' if r['workers'] > 1 else ''})"
            + (f", pedido: {r['modo_pedido']}" if r['modo_pedido'] != r['modo'] else '')
            + ('' if r['com_ia'] else ' | sem o ThoLuk (afinidade por IA)'))
        self.stdout.write(
            f"  carregar {r['tempo_carregar_s']:.2f} s · calcular {r['tempo_calcular_s']:.2f} s · "
            f"gravar {r['tempo_gravar_s']:.2f} s")
        self.stdout.write(self.style.SUCCESS(f"Concluído em {r['tempo_total_s']:.2f}s."))

    def _loop(self):
        import time

        from matches.servicos import recalcular_loop
        from perfis.models import Perfil

        buscando = list(Perfil.objects.filter(usuario__tipo='buscando_vaga').select_related('usuario', 'embedding_ia'))
        self.stdout.write(f'Método: loop | Recalculando compatibilidades para {len(buscando)} perfis buscando_vaga…')
        inicio = time.perf_counter()
        for i, perfil in enumerate(buscando, 1):
            recalcular_loop(perfil)
            if i % 10 == 0 or i == len(buscando):
                self.stdout.write(f'  {i}/{len(buscando)} processados')
        self.stdout.write(self.style.SUCCESS(f'Concluído em {time.perf_counter() - inicio:.2f}s.'))
