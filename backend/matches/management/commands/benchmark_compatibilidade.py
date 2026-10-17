"""
python manage.py benchmark_compatibilidade [--repeticoes N] [--incluir-10000] [--sem-banco]

Medições:
  A) Cálculo puro em memória — loop (calcular_score) vs NumPy (calcular_scores_lote)
     N = 100, 1 000, 10 000, 50 000, 100 000
  B) Ponta a ponta com banco — recalcular_loop vs recalcular_lote
     N = 100, 1 000, 5 000 (+ 10 000 com --incluir-10000)
     Todo dado sintético criado é revertido via rollback (sem rastro no banco).
  C) Análise de sensibilidade dos pesos (sem banco, em memória)
     20 bases × 1 000 outros; top-10 overlap para +-5pp em cada critério.

Saídas:
  docs/benchmark/benchmark_compatibilidade.csv
  docs/benchmark/sensibilidade_pesos.csv
  docs/benchmark/ambiente.txt
"""

import csv
import os
import platform
import random
import statistics
import sys
import time
import traceback
from datetime import datetime
from types import SimpleNamespace

import numpy as np

import django
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.models import Q
from django.test.utils import CaptureQueriesContext

from matches.algoritmo import PESOS, calcular_score, calcular_scores_lote
from matches.models import Compatibilidade
from matches.servicos import recalcular_lote, recalcular_loop
from perfis.models import Perfil
from usuarios.models import Usuario


# ── Constantes de geração sintética ──────────────────────────────────────────

_HORARIOS = ['madrugador', 'noturno', 'flexivel']
_VISITAS  = ['raramente', 'as_vezes', 'frequentemente']
_IMOVEIS  = ['apartamento', 'casa', 'republica', 'indiferente']
_REGIOES  = ['Boa Viagem', 'Recife', 'Olinda', 'Piedade', 'Candeias']


def _ns(pid: int, rng: random.Random) -> SimpleNamespace:
    """Perfil leve (SimpleNamespace) com todos os atributos lidos por calcular_score."""
    orc_min = float(rng.randint(500, 3000))
    return SimpleNamespace(
        id=pid,
        orcamento_min=orc_min,
        orcamento_max=orc_min + float(rng.randint(100, 2000)),
        regiao=rng.choice(_REGIOES),
        fumante=rng.choice([True, False]),
        aceita_pets=rng.choice([True, False]),
        tolerancia_bagunca=rng.randint(1, 5),
        nivel_organizacao=rng.randint(1, 5),
        perfil_horario=rng.choice(_HORARIOS),
        nivel_ruido=rng.randint(1, 5),
        nivel_social=rng.randint(1, 5),
        aceita_visitas=rng.choice(_VISITAS),
        tipo_imovel=rng.choice(_IMOVEIS),
        qtd_moradores=rng.randint(1, 4),
        idade=rng.randint(18, 60),
    )


def _perfil_db(usuario, idx: int) -> Perfil:
    """Instância de Perfil (não salva) para bulk_create — não dispara signals."""
    orc_min = 500 + (idx * 7) % 2500
    return Perfil(
        usuario=usuario,
        nome=f'Bench {idx}',
        idade=18 + (idx * 3) % 42,
        regiao=_REGIOES[idx % len(_REGIOES)],
        bio='',
        orcamento_min=orc_min,
        orcamento_max=orc_min + 500 + (idx * 11) % 1500,
        fumante=bool(idx % 2),
        aceita_pets=bool((idx + 1) % 2),
        tolerancia_bagunca=1 + idx % 5,
        nivel_organizacao=1 + (idx + 2) % 5,
        perfil_horario=_HORARIOS[idx % 3],
        nivel_ruido=1 + (idx + 1) % 5,
        nivel_social=1 + (idx + 2) % 5,
        aceita_visitas=_VISITAS[idx % 3],
        tipo_imovel=_IMOVEIS[idx % 4],
        qtd_moradores=1 + idx % 4,
    )


def _redistribuir(pesos_base: dict, criterio: str, delta: float) -> dict:
    """
    Varia o peso de `criterio` em `delta` pp e redistribui a variação
    proporcionalmente entre os outros 5 critérios, mantendo soma = 1.0.
    """
    novo = dict(pesos_base)
    novo[criterio] = max(0.0, pesos_base[criterio] + delta)
    variacao_real = novo[criterio] - pesos_base[criterio]
    outros = [k for k in pesos_base if k != criterio]
    soma_outros = sum(pesos_base[k] for k in outros)
    if soma_outros > 0:
        for k in outros:
            novo[k] = max(0.0, pesos_base[k] - pesos_base[k] / soma_outros * variacao_real)
    total = sum(novo.values())
    return {k: v / total for k, v in novo.items()}


# ── Command ───────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = 'Benchmark comparando a versão em loop com a versão NumPy.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--repeticoes', type=int, default=5,
            help='Repetições cronometradas por medição (padrão 5).',
        )
        parser.add_argument(
            '--incluir-10000', action='store_true',
            help='Inclui N=10.000 na medição B (banco).',
        )
        parser.add_argument(
            '--sem-banco', action='store_true',
            help='Executa só a medição A (memória) — não acessa o banco.',
        )

    # ── handle ────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        reps      = options['repeticoes']
        sem_banco = options['sem_banco']
        inc10k    = options['incluir_10000']

        rows_a: list[dict] = []
        rows_b: list[dict] = []
        rows_c: list[dict] = []

        # ── A) Memória ────────────────────────────────────────────────────────
        self._linha('=')
        self.stdout.write(f'  A) Cálculo em memória (sem banco)  —  rep={reps}')
        self._linha('=')
        self.stdout.write(
            f"{'N':>9}  {'Loop med(s)':>12}  {'Loop min(s)':>12}  "
            f"{'NumPy med(s)':>13}  {'NumPy min(s)':>13}  "
            f"{'Speedup':>8}  {'MaxDiff':>10}"
        )
        self._linha('-')

        for N in (100, 1_000, 10_000, 50_000, 100_000):
            row = self._medir_memoria(N, reps)
            self.stdout.write(
                f"{N:>9,}  {row['loop_mediana']:>12.6f}  {row['loop_min']:>12.6f}  "
                f"{row['numpy_mediana']:>13.6f}  {row['numpy_min']:>13.6f}  "
                f"{row['speedup']:>7.2f}x  {row['max_diff']:>10.2e}"
            )
            self.stdout.flush()
            rows_a.append(row)

        # ── B) Banco ──────────────────────────────────────────────────────────
        if not sem_banco:
            sizes_b = [100, 1_000, 5_000]
            if inc10k:
                sizes_b.append(10_000)

            self.stdout.write('')
            self._linha('=')
            self.stdout.write(f'  B) Ponta a ponta com banco  —  rep={reps}')
            self._linha('=')
            self.stdout.write(
                f"{'N req':>6}  {'N real':>7}  "
                f"{'Loop med(s)':>12}  {'Loop min(s)':>12}  "
                f"{'NumPy med(s)':>13}  {'NumPy min(s)':>13}  "
                f"{'Speedup':>8}  {'Qry Loop':>9}  {'Qry NumPy':>9}"
            )
            self._linha('-')

            for N in sizes_b:
                row = self._medir_banco(N, reps)
                if row is None:
                    self.stdout.write(f'{N:>6,}       [ERRO - ver stderr]')
                else:
                    nota = f" (reps={row['reps_efetivos']})" if row['reps_efetivos'] < reps else ''
                    self.stdout.write(
                        f"{N:>6,}  {row['N_real']:>7,}  "
                        f"{row['loop_mediana']:>12.6f}  {row['loop_min']:>12.6f}  "
                        f"{row['numpy_mediana']:>13.6f}  {row['numpy_min']:>13.6f}  "
                        f"{row['speedup']:>7.2f}x  "
                        f"{row['queries_loop']:>9}  {row['queries_numpy']:>9}{nota}"
                    )
                    self.stdout.flush()
                    rows_b.append(row)

        # ── C) Sensibilidade ──────────────────────────────────────────────────
        self.stdout.write('')
        self._linha('=')
        self.stdout.write(
            '  C) Sensibilidade dos pesos  '
            '(20 bases × 1.000 outros, top-10 overlap médio)'
        )
        self._linha('=')
        rows_c = self._medir_sensibilidade()
        self.stdout.write(
            f"{'Critério':>12}  {'Peso atual':>10}  "
            f"{'+5pp overlap':>14}  {'-5pp overlap':>14}"
        )
        self._linha('-')
        for r in rows_c:
            self.stdout.write(
                f"{r['criterio']:>12}  {PESOS[r['criterio']]:>10.2f}  "
                f"{r['overlap_mais5']:>13.4f}  {r['overlap_menos5']:>13.4f}"
            )

        # ── Salvar ────────────────────────────────────────────────────────────
        docs = self._docs_dir()
        os.makedirs(docs, exist_ok=True)
        self._salvar_benchmark_csv(rows_a, rows_b, docs)
        self._salvar_sensibilidade_csv(rows_c, docs)
        self._salvar_ambiente(docs)
        self.stdout.write(self.style.SUCCESS(f'\nArquivos salvos em: {docs}'))

    # ── A) medição em memória ─────────────────────────────────────────────────

    def _medir_memoria(self, N: int, reps: int) -> dict:
        rng = random.Random(42)
        base   = _ns(0, rng)
        outros = [_ns(i + 1, rng) for i in range(N)]

        # warmup — descartado
        for o in outros:
            calcular_score(base, o)
        calcular_scores_lote(base, outros)

        # verificação de equivalência (1 execução pós-warmup)
        s_loop = [calcular_score(base, o) for o in outros]
        _, s_np = calcular_scores_lote(base, outros)
        max_diff = max(abs(a - b) for a, b in zip(s_loop, s_np.tolist()))

        # cronometrar loop
        t_loop = []
        for _ in range(reps):
            t0 = time.perf_counter()
            for o in outros:
                calcular_score(base, o)
            t_loop.append(time.perf_counter() - t0)

        # cronometrar NumPy (inclui montagem dos arrays internamente)
        t_np = []
        for _ in range(reps):
            t0 = time.perf_counter()
            calcular_scores_lote(base, outros)
            t_np.append(time.perf_counter() - t0)

        med_l, min_l = statistics.median(t_loop), min(t_loop)
        med_n, min_n = statistics.median(t_np),   min(t_np)
        return dict(
            tipo='memoria', N=N, N_real=N,
            loop_mediana=med_l, loop_min=min_l,
            numpy_mediana=med_n, numpy_min=min_n,
            speedup=med_l / med_n if med_n > 0 else float('inf'),
            max_diff=max_diff,
            queries_loop='', queries_numpy='',
        )

    # ── B) medição com banco ──────────────────────────────────────────────────

    def _medir_banco(self, N_req: int, reps: int) -> dict | None:
        try:
            with transaction.atomic():
                try:
                    return self._medir_banco_inner(N_req, reps)
                finally:
                    # garante rollback mesmo em caso de erro
                    transaction.set_rollback(True)
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f'  ERRO B N={N_req}: {exc}'))
            self.stderr.write(traceback.format_exc())
            return None

    def _medir_banco_inner(self, N_req: int, reps: int) -> dict:
        # Quantos perfis do tipo oposto já existem?
        n_pre_o = Perfil.objects.filter(usuario__tipo='oferecendo_vaga').count()
        n_criar = max(0, N_req - n_pre_o)

        # Criar usuários oferecendo (bulk_create não dispara post_save)
        u_ofere = Usuario.objects.bulk_create([
            Usuario(
                username=f'_bch_o_{i}',
                email=f'_bch_o_{i}@benchmark.local',
                tipo='oferecendo_vaga',
                password=make_password(None),
            )
            for i in range(n_criar)
        ])

        # Criar usuário buscando
        u_busc = Usuario.objects.bulk_create([
            Usuario(
                username='_bch_b_0',
                email='_bch_b_0@benchmark.local',
                tipo='buscando_vaga',
                password=make_password(None),
            )
        ])[0]

        # Criar perfis (bulk_create — sem signal post_save)
        if u_ofere:
            Perfil.objects.bulk_create(
                [_perfil_db(u, i) for i, u in enumerate(u_ofere)]
            )

        perfil_novo_list = Perfil.objects.bulk_create(
            [_perfil_db(u_busc, n_criar)]
        )
        perfil_novo = perfil_novo_list[0]
        perfil_novo.usuario = u_busc  # garante acesso sem query extra

        N_real = Perfil.objects.filter(usuario__tipo='oferecendo_vaga').count()

        def limpar():
            Compatibilidade.objects.filter(
                Q(perfil_a_id=perfil_novo.id) | Q(perfil_b_id=perfil_novo.id)
            ).delete()

        # warmup — descartado; mede o loop para decidir reps adaptativos
        t_wup = time.perf_counter()
        recalcular_loop(perfil_novo);  limpar()
        recalcular_lote(perfil_novo);  limpar()
        t_wup = time.perf_counter() - t_wup

        # Se o warmup do loop demorar mais de 30s, reduz reps para evitar timeout
        _MAX_WARMUP_PARA_REPS_NORMAIS = 30.0
        reps_efetivos = reps if t_wup <= _MAX_WARMUP_PARA_REPS_NORMAIS else 2
        if reps_efetivos < reps:
            self.stdout.write(
                f'  [aviso B N={N_req}] warmup={t_wup:.1f}s > {_MAX_WARMUP_PARA_REPS_NORMAIS}s '
                f'-> reps reduzidos de {reps} para {reps_efetivos}'
            )

        # medições
        t_loop, t_np = [], []
        qry_loop = qry_np = 0

        for rep in range(reps_efetivos):
            with CaptureQueriesContext(connection) as ctx:
                t0 = time.perf_counter()
                recalcular_loop(perfil_novo)
                t_loop.append(time.perf_counter() - t0)
            if rep == 0:
                qry_loop = len(ctx)
            limpar()

            with CaptureQueriesContext(connection) as ctx:
                t0 = time.perf_counter()
                recalcular_lote(perfil_novo)
                t_np.append(time.perf_counter() - t0)
            if rep == 0:
                qry_np = len(ctx)
            limpar()

        med_l, min_l = statistics.median(t_loop), min(t_loop)
        med_n, min_n = statistics.median(t_np),   min(t_np)
        return dict(
            tipo='banco', N=N_req, N_real=N_real,
            reps_efetivos=reps_efetivos,
            loop_mediana=med_l, loop_min=min_l,
            numpy_mediana=med_n, numpy_min=min_n,
            speedup=med_l / med_n if med_n > 0 else float('inf'),
            max_diff='',
            queries_loop=qry_loop, queries_numpy=qry_np,
        )

    # ── C) sensibilidade dos pesos ────────────────────────────────────────────

    def _medir_sensibilidade(self) -> list[dict]:
        rng    = random.Random(42)
        outros = [_ns(i,         rng) for i in range(1_000)]
        bases  = [_ns(1_000 + i, rng) for i in range(20)]

        rows = []
        for criterio in PESOS:
            ov_p, ov_m = [], []
            for base in bases:
                _, s_ref   = calcular_scores_lote(base, outros)
                top_ref    = set(np.argsort(s_ref)[::-1][:10].tolist())

                p_mais     = _redistribuir(PESOS, criterio, +0.05)
                _, s_mais  = calcular_scores_lote(base, outros, pesos=p_mais)
                top_mais   = set(np.argsort(s_mais)[::-1][:10].tolist())

                p_menos    = _redistribuir(PESOS, criterio, -0.05)
                _, s_menos = calcular_scores_lote(base, outros, pesos=p_menos)
                top_menos  = set(np.argsort(s_menos)[::-1][:10].tolist())

                ov_p.append(len(top_ref & top_mais)  / 10)
                ov_m.append(len(top_ref & top_menos) / 10)

            rows.append(dict(
                criterio=criterio,
                overlap_mais5=statistics.mean(ov_p),
                overlap_menos5=statistics.mean(ov_m),
            ))
        return rows

    # ── persistência ─────────────────────────────────────────────────────────

    def _docs_dir(self) -> str:
        # commands → management → matches → backend → projeto_root
        projeto = os.path.dirname(
            os.path.dirname(
                os.path.dirname(
                    os.path.dirname(
                        os.path.dirname(os.path.abspath(__file__))
                    )
                )
            )
        )
        return os.path.join(projeto, 'docs', 'benchmark')

    def _salvar_benchmark_csv(self, rows_a: list, rows_b: list, docs: str):
        path = os.path.join(docs, 'benchmark_compatibilidade.csv')
        campos = [
            'tipo', 'N', 'N_real',
            'loop_mediana', 'loop_min',
            'numpy_mediana', 'numpy_min',
            'speedup', 'max_diff',
            'queries_loop', 'queries_numpy',
        ]
        with open(path, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=campos)
            w.writeheader()
            for row in rows_a + rows_b:
                w.writerow({k: row.get(k, '') for k in campos})
        self.stdout.write(f'  -> {path}')

    def _salvar_sensibilidade_csv(self, rows: list, docs: str):
        path = os.path.join(docs, 'sensibilidade_pesos.csv')
        with open(path, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=['criterio', 'peso_atual', 'delta', 'overlap_medio'])
            w.writeheader()
            for r in rows:
                w.writerow(dict(criterio=r['criterio'],
                                peso_atual=PESOS[r['criterio']],
                                delta='+5pp',
                                overlap_medio=r['overlap_mais5']))
                w.writerow(dict(criterio=r['criterio'],
                                peso_atual=PESOS[r['criterio']],
                                delta='-5pp',
                                overlap_medio=r['overlap_menos5']))
        self.stdout.write(f'  -> {path}')

    def _salvar_ambiente(self, docs: str):
        from django.conf import settings as dj_settings
        path = os.path.join(docs, 'ambiente.txt')
        try:
            cpu = platform.processor() or platform.machine() or 'N/A'
        except Exception:
            cpu = 'N/A'
        db_cfg  = dj_settings.DATABASES.get('default', {})
        db_info = f"{db_cfg.get('ENGINE', 'N/A')}  db={db_cfg.get('NAME', 'N/A')}"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(f"Data/hora    : {datetime.now().isoformat()}\n")
            f.write(f"Python       : {sys.version}\n")
            f.write(f"NumPy        : {np.__version__}\n")
            f.write(f"Django       : {django.__version__}\n")
            f.write(f"Sistema      : {platform.system()} {platform.release()}\n")
            f.write(f"CPU          : {cpu}\n")
            f.write(f"Banco        : {db_info}\n")
        self.stdout.write(f'  -> {path}')

    # ── utilitário ────────────────────────────────────────────────────────────

    def _linha(self, char: str = '-', width: int = 80):
        self.stdout.write(char * width)
