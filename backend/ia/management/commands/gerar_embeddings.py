"""
python manage.py gerar_embeddings [--forcar] [--lote 32] [--sem-recalcular]

Gera (ou atualiza) o embedding da bio de TODOS os perfis e, em seguida, recalcula as compatibilidades.
Sem --forcar, só processa os perfis cujo texto (bio + anúncio) mudou desde a última geração ou que
foram gerados por outro modelo. Com --forcar, regera tudo (use depois de mudar ia/temas.py).
"""

import time
from collections import Counter

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from ia import embeddings, servico
from perfis.models import Perfil


class Command(BaseCommand):
    help = 'Gera os embeddings das bios de todos os perfis (Afinidade por IA) e recalcula as compatibilidades.'

    def add_arguments(self, parser):
        parser.add_argument('--forcar', action='store_true', help='regera todos, mesmo sem mudança no texto')
        parser.add_argument('--lote', type=int, default=32, help='perfis por lote (uma consulta ao banco por lote; padrão 32)')
        parser.add_argument('--sem-recalcular', action='store_true', help='não roda recalcular_compatibilidades no final')

    def handle(self, *args, **opts):
        if not servico.habilitada():
            raise CommandError('A IA está desligada (IA_HABILITADA=False).')
        if not servico.disponivel(carregar=True):
            raise CommandError(f"Modelo de IA indisponível: {servico.estado()['erro']}. Rode antes: python manage.py baixar_modelo_ia")

        perfis = list(Perfil.objects.select_related('usuario').order_by('id'))
        total = len(perfis)
        lote = max(1, opts['lote'])
        self.stdout.write(f'Modelo: {servico.nome_modelo()} | perfis: {total} | '
                          f"{'regerando todos' if opts['forcar'] else 'só os que mudaram'}")

        contagem = Counter()
        inicio = time.perf_counter()
        for i in range(0, total, lote):
            contagem.update(embeddings.atualizar_lote(perfis[i:i + lote], forcar=opts['forcar']))
            feitos = min(i + lote, total)
            self.stdout.write(f'  {feitos}/{total} perfis ({time.perf_counter() - inicio:.1f} s)')
        gasto = time.perf_counter() - inicio

        gerados = contagem[embeddings.CRIADO] + contagem[embeddings.ATUALIZADO]
        self.stdout.write(
            f'Embeddings: {contagem[embeddings.CRIADO]} criados, {contagem[embeddings.ATUALIZADO]} atualizados, '
            f'{contagem[embeddings.INALTERADO]} sem mudança, {contagem[embeddings.SEM_TEXTO]} sem bio suficiente, '
            f'{contagem[embeddings.REMOVIDO]} removidos (bio ficou curta)'
            + (f', {contagem[embeddings.INDISPONIVEL] + contagem[embeddings.ERRO]} com falha' if
               contagem[embeddings.INDISPONIVEL] + contagem[embeddings.ERRO] else '') + '.')
        self.stdout.write(f'Tempo: {gasto:.2f} s' + (f' ({gasto * 1000 / gerados:.1f} ms por embedding gerado)' if gerados else ''))

        if not opts['sem_recalcular']:
            call_command('recalcular_compatibilidades', stdout=self.stdout)
        if contagem[embeddings.INDISPONIVEL] + contagem[embeddings.ERRO]:
            raise CommandError('Alguns embeddings falharam; veja o log do servidor.')
        self.stdout.write(self.style.SUCCESS('Embeddings prontos.'))
