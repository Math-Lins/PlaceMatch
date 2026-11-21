"""
python manage.py gerar_embeddings [--forcar] [--lote 32] [--workers 2] [--sem-recalcular]

Gera (ou atualiza) o embedding da bio de TODOS os perfis e, em seguida, recalcula as compatibilidades.
Sem --forcar, só processa os perfis cujo texto (bio + anúncio) mudou desde a última geração ou que
foram gerados por outro modelo. Com --forcar, regera tudo (use depois de mudar ia/temas.py).

--workers N (padrão 2, máximo 3): paralelismo de dados do fastembed. Os textos pendentes são divididos
entre N processos, e cada um carrega o próprio modelo (~560 MB e alguns segundos). Com o processo principal,
que também tem o modelo, são N + 1 processos com o modelo: o máximo de 3 mantém isso em 4. Os vetores são
IDÊNTICOS aos do modo sequencial. O paralelo só é usado quando compensa:
  - há pelo menos MIN_TEXTOS_PARALELO textos pendentes (abaixo disso, criar os processos custa mais que o
    ganho; medido no benchmark_paralelismo);
  - há memória livre para os N modelos (senão, N é reduzido, com aviso).
"""

import time
from collections import Counter

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from ia import embeddings, servico
from matches.algoritmo.paralelo import memoria_livre_mb
from perfis.models import Perfil

MAX_WORKERS = 3          # + o processo principal = 4 processos com o modelo carregado, no máximo
WORKERS_PADRAO = 2
MB_POR_WORKER = 700      # pico medido de um processo com o modelo (~645 MB) + folga
MIN_TEXTOS_PARALELO = 400


def paralelo_disponivel() -> bool:
    """Só o modelo real (fastembed) tem paralelismo de dados; o embedder falso dos testes é instantâneo."""
    return not servico.usando_falso()


def workers_possiveis(pedidos: int, livre_mb: float | None) -> int:
    """Quantos workers cabem na memória livre (deixando 1 GB para o resto da máquina)."""
    if pedidos <= 1 or livre_mb is None:
        return pedidos
    return max(1, min(pedidos, int((livre_mb - 1024) // MB_POR_WORKER)))


class Command(BaseCommand):
    help = 'Gera os embeddings das bios de todos os perfis (ThoLuk, a IA de afinidade) e recalcula as compatibilidades.'

    def add_arguments(self, parser):
        parser.add_argument('--forcar', action='store_true', help='regera todos, mesmo sem mudança no texto')
        parser.add_argument('--lote', type=int, default=32, help='perfis por lote (uma consulta ao banco por lote; padrão 32)')
        parser.add_argument('--workers', type=int, default=WORKERS_PADRAO,
                            help=f'processos do fastembed (1 a {MAX_WORKERS}; padrão {WORKERS_PADRAO}). '
                                 f'Só é usado com {MIN_TEXTOS_PARALELO}+ textos pendentes.')
        parser.add_argument('--sem-recalcular', action='store_true', help='não roda recalcular_compatibilidades no final')

    def handle(self, *args, **opts):
        workers = opts['workers']
        if not 1 <= workers <= MAX_WORKERS:
            raise CommandError(f'--workers deve ser um número entre 1 e {MAX_WORKERS} (cada worker carrega o modelo, '
                               f'~560 MB; com o processo principal são no máximo 4). Recebido: {workers}.')
        if opts['lote'] < 1:
            raise CommandError('--lote deve ser um número maior que zero.')
        if not servico.habilitada():
            raise CommandError('O ThoLuk está desligado (IA_HABILITADA=False).')
        if not servico.disponivel(carregar=True):
            raise CommandError(f"O ThoLuk está indisponível: {servico.estado()['erro']}. Rode antes: python manage.py baixar_modelo_ia")

        perfis = list(Perfil.objects.select_related('usuario').order_by('id'))
        total = len(perfis)
        lote = opts['lote']
        self.stdout.write(f'ThoLuk | modelo: {servico.nome_modelo()} | perfis: {total} | '
                          f"{'regerando todos' if opts['forcar'] else 'só os que mudaram'}")

        usar = self._workers_efetivos(workers, embeddings.contar_pendentes(perfis, opts['forcar']))
        contagem = Counter()
        inicio = time.perf_counter()
        if usar > 1:
            # Uma única chamada com todos os textos: o pool do fastembed (e a carga do modelo em cada
            # worker) acontece uma vez só, não uma vez por lote.
            contagem.update(embeddings.atualizar_lote(perfis, forcar=opts['forcar'], workers=usar))
            self.stdout.write(f'  {total}/{total} perfis ({time.perf_counter() - inicio:.1f} s)')
        else:
            for i in range(0, total, lote):
                contagem.update(embeddings.atualizar_lote(perfis[i:i + lote], forcar=opts['forcar']))
                feitos = min(i + lote, total)
                self.stdout.write(f'  {feitos}/{total} perfis ({time.perf_counter() - inicio:.1f} s)')
        gasto = time.perf_counter() - inicio

        gerados = contagem[embeddings.CRIADO] + contagem[embeddings.ATUALIZADO]
        falhas = contagem[embeddings.INDISPONIVEL] + contagem[embeddings.ERRO]
        self.stdout.write(
            f'Embeddings: {contagem[embeddings.CRIADO]} criados, {contagem[embeddings.ATUALIZADO]} atualizados, '
            f'{contagem[embeddings.INALTERADO]} sem mudança, {contagem[embeddings.SEM_TEXTO]} sem bio suficiente, '
            f'{contagem[embeddings.REMOVIDO]} removidos (bio ficou curta)'
            + (f', {falhas} com falha' if falhas else '') + '.')
        self.stdout.write(f'Tempo: {gasto:.2f} s' + (
            f' ({gasto * 1000 / gerados:.1f} ms por perfil gerado, {usar} worker{"s" if usar > 1 else ""})' if gerados else ''))

        if not opts['sem_recalcular']:
            call_command('recalcular_compatibilidades', stdout=self.stdout, stderr=self.stderr)
        if falhas:
            raise CommandError('Alguns embeddings falharam; veja o log do servidor.')
        self.stdout.write(self.style.SUCCESS('ThoLuk pronto: embeddings e temas atualizados.'))

    def _workers_efetivos(self, pedidos: int, pendentes: int) -> int:
        if pedidos <= 1 or not paralelo_disponivel():
            return 1
        if pendentes < MIN_TEXTOS_PARALELO:
            self.stdout.write(f'  {pendentes} texto(s) para gerar: abaixo de {MIN_TEXTOS_PARALELO}, o modo sequencial é mais '
                              f'rápido (criar {pedidos} processos e carregar o modelo em cada um custa ~15 s).')
            return 1
        livre = memoria_livre_mb()
        cabem = workers_possiveis(pedidos, livre)
        if cabem < pedidos:
            self.stderr.write(self.style.WARNING(
                f'Aviso: memória livre de {livre:.0f} MB comporta só {cabem} worker(s) com o modelo (~{MB_POR_WORKER} MB '
                f'cada); usando {cabem} em vez de {pedidos}.'))
        self.stdout.write(f'  {pendentes} texto(s) para gerar com {cabem} worker{"s" if cabem > 1 else ""} '
                          f'(paralelismo de dados do fastembed).')
        return cabem
