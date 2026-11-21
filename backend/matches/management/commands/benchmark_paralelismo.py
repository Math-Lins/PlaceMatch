"""
python manage.py benchmark_paralelismo [--tamanhos 1000,2000,5000,10000,20000] [--workers 1,2,4] [--repeticoes 3]
                                       [--bios 50,400] [--sem-embeddings] [--sem-grafico]
                                       [--banco-descartavel [--tamanhos-banco 1000] [--repeticoes-banco 1]]

Mede o ganho do paralelismo nos processamentos em lote (veja docs/algoritmo-compatibilidade.md, "Paralelismo").

A) Recálculo das compatibilidades — DADOS SINTÉTICOS EM MEMÓRIA (não lê nem grava no banco):
   N perfis (metade buscando, metade oferecendo, 4 em cada 5 com embedding) → N²/4 pares, nos modos
   sequencial, threads e processos com 1, 2 e 4 workers. Aquecimento antes; mediana de 3 repetições. Cada
   configuração confere se a matriz de scores é IDÊNTICA à do sequencial. Tamanhos que não cabem na memória
   livre são pulados (com o motivo no relatório).
B) gerar_embeddings — 50 (e 400) bios com 1 e 2 workers do fastembed, com o modelo real (pulado sem o modelo).
   Os vetores não são gravados.
C) Ponta a ponta no banco (só com --banco-descartavel): carregar + calcular + gravar, para mostrar a parte
   sequencial (banco) na Lei de Amdahl. Exige um banco VAZIO (nenhum usuário): cria os dados, mede e apaga.

Saídas em docs/benchmark/: paralelismo.json (lido por GET /api/admin/processamento/benchmark/),
paralelismo.csv e paralelismo.png (tempo × workers e speedup × workers).

speedup = tempo sequencial ÷ tempo paralelo; eficiência = speedup ÷ workers.
Fração paralelizável (Lei de Amdahl): S(n) = 1 / ((1 - p) + p / n) → p ajustado por mínimos quadrados com
n = 2 e 4 (com 1 worker não há o que estimar).
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import platform
import statistics
import sys
import time
from datetime import datetime

import numpy as np
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from matches.algoritmo import paralelo
from matches.algoritmo.matriz import COLUNAS_POR_BLOCO, LINHAS_POR_BLOCO, Grupo

MODOS_PARALELOS = ('threads', 'processos')


# ── Dados sintéticos ───────────────────────────────────────────────────────────

def grupo_sintetico(n: int, semente: int, primeiro_id: int) -> Grupo:
    """n perfis com atributos aleatórios (faixas reais do formulário); 1 em cada 5 sem embedding."""
    g = np.random.default_rng(semente)
    orc_min = g.integers(500, 3000, n).astype(np.float64)
    vetores = g.standard_normal((n, 384)).astype(np.float32) + g.standard_normal(384).astype(np.float32)
    vetores /= np.linalg.norm(vetores, axis=1, keepdims=True)
    tem = (np.arange(n) % 5) != 0
    vetores[~tem] = 0.0

    def escala():
        return g.integers(1, 6, n).astype(np.float64)

    return Grupo(
        ids=np.arange(primeiro_id, primeiro_id + n, dtype=np.int64),
        orc_min=orc_min, orc_max=orc_min + g.integers(100, 2000, n),
        regiao=g.integers(0, 6, n).astype(np.int32), horario=g.integers(0, 3, n).astype(np.intp), ruido=escala(),
        fumante=g.random(n) < 0.3, pets=g.random(n) < 0.5, visitas=g.integers(0, 3, n).astype(np.intp),
        bagunca=escala(), organizacao=escala(), social=escala(), imovel=g.integers(0, 4, n).astype(np.intp),
        moradores=g.integers(1, 5, n).astype(np.float64), idade=g.integers(18, 61, n).astype(np.float64),
        vetores=vetores, tem_vetor=tem,
    )


def _br(n: int) -> str:
    """1234567 → '1.234.567'."""
    return f'{n:,}'.replace(',', '.')


def _hash(m: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(m).tobytes()).hexdigest()[:16]


def ajustar_amdahl(pontos: list[tuple[int, float]]) -> float | None:
    """p (0..1) que melhor explica os speedups medidos [(workers, speedup)], workers > 1."""
    xs = [(1 - 1 / n, 1 - 1 / s) for n, s in pontos if n > 1 and s > 0]
    if not xs:
        return None
    p = sum(a * b for a, b in xs) / sum(a * a for a, _ in xs)
    return round(min(1.0, max(0.0, p)), 4)


def _versao(pacote: str) -> str | None:
    try:
        from importlib.metadata import version
        return version(pacote)
    except Exception:  # noqa: BLE001 — pacote opcional
        return None


def carga_cpu_pct(amostras: int = 5) -> int | None:
    """Uso médio da CPU por outros programas antes do benchmark (Windows: LoadPercentage; Linux: /proc/stat)."""
    try:
        if sys.platform == 'win32':
            import subprocess
            cmd = ('$v = 1..%d | ForEach-Object { (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage '
                   '-Average).Average; Start-Sleep -Milliseconds 700 }; [int](($v | Measure-Object -Average).Average)') % amostras
            saida = subprocess.run(['powershell', '-NoProfile', '-Command', cmd], capture_output=True, text=True,
                                   timeout=60).stdout.strip()
            return int(saida) if saida.isdigit() else None

        def ler():
            with open('/proc/stat', encoding='ascii') as f:
                v = [int(x) for x in f.readline().split()[1:]]
            return sum(v), v[3] + v[4]
        t0, o0 = ler()
        time.sleep(0.7 * amostras)
        t1, o1 = ler()
        return round(100 * (1 - (o1 - o0) / max(1, t1 - t0)))
    except Exception:  # noqa: BLE001 — informação opcional
        return None


def ambiente() -> dict:
    nucleos_fisicos = None
    cpu = platform.processor() or platform.machine()
    if sys.platform == 'win32':
        try:
            import subprocess
            saida = subprocess.run(
                ['powershell', '-NoProfile', '-Command',
                 '(Get-CimInstance Win32_Processor | Select-Object -First 1 | '
                 'ForEach-Object { $_.Name + "|" + $_.NumberOfCores + "|" + $_.LoadPercentage })'],
                capture_output=True, text=True, timeout=30).stdout.strip()
            nome, fisicos, carga = (saida.split('|') + ['', '', ''])[:3]
            cpu, nucleos_fisicos = nome.strip() or cpu, int(fisicos) if fisicos.strip().isdigit() else None
            carga_cpu = int(carga) if carga.strip().isdigit() else None
        except Exception:  # noqa: BLE001 — informação opcional
            carga_cpu = None
    else:
        carga_cpu = None
        try:
            with open('/proc/cpuinfo', encoding='utf-8') as f:
                info = f.read()
            nomes = [linha.split(':', 1)[1].strip() for linha in info.splitlines() if linha.startswith('model name')]
            cpu = nomes[0] if nomes else cpu
            ids = {linha for linha in info.splitlines() if linha.startswith(('physical id', 'core id'))}
            nucleos_fisicos = len({linha for linha in ids if linha.startswith('core id')}) or None
        except OSError:
            pass
    return {
        'cpu': cpu, 'nucleos_fisicos': nucleos_fisicos, 'nucleos_logicos': os.cpu_count(),
        'ram_total_mb': paralelo.memoria_total_mb(), 'ram_livre_mb': paralelo.memoria_livre_mb(),
        'carga_cpu_inicio_pct': carga_cpu, 'carga_cpu_fundo_pct': carga_cpu_pct(),
        'sistema': f'{platform.system()} {platform.release()} ({platform.version()})',
        'python': platform.python_version(), 'numpy': np.__version__, 'django': _versao('django'),
        'threadpoolctl': _versao('threadpoolctl'), 'fastembed': _versao('fastembed'), 'onnxruntime': _versao('onnxruntime'),
        'blas': _blas(),
    }


def _blas() -> str | None:
    try:
        from threadpoolctl import threadpool_info
        libs = [f"{i.get('internal_api')} {i.get('version')} ({i.get('num_threads')} threads)"
                for i in threadpool_info() if i.get('user_api') == 'blas']
        return ', '.join(libs) or None
    except Exception:  # noqa: BLE001
        return None


# ── Comando ────────────────────────────────────────────────────────────────────

def _lista(texto: str) -> list[int]:
    try:
        valores = [int(x) for x in texto.split(',') if x.strip()]
    except ValueError:
        raise CommandError(f'Lista inválida: {texto!r} (use números separados por vírgula).') from None
    if not valores or any(v < 1 for v in valores):
        raise CommandError(f'Lista inválida: {texto!r} (os números devem ser maiores que zero).')
    return valores


class Command(BaseCommand):
    help = 'Benchmark do paralelismo (processos × threads × sequencial) no recálculo e nos embeddings.'

    def add_arguments(self, parser):
        parser.add_argument('--tamanhos', default='1000,2000,5000,10000,20000', help='N de perfis (metade de cada tipo).')
        parser.add_argument('--workers', default='1,2,4', help='números de workers dos modos paralelos.')
        parser.add_argument('--repeticoes', type=int, default=3, help='repetições cronometradas (mediana); padrão 3.')
        parser.add_argument('--bios', default='50,400', help='quantidades de bios na medição de embeddings.')
        parser.add_argument('--sem-embeddings', action='store_true', help='pula a medição B (embeddings).')
        parser.add_argument('--banco-descartavel', action='store_true',
                            help='inclui a medição C (ponta a ponta) — o banco precisa estar VAZIO.')
        parser.add_argument('--tamanhos-banco', default='1000', help='N da medição C (padrão 1000 = 250.000 pares gravados).')
        parser.add_argument('--repeticoes-banco', type=int, default=1,
                            help='repetições da medição C (padrão 1: gravar 250.000 pares leva perto de 1 minuto).')
        parser.add_argument('--sem-grafico', action='store_true', help='não gera o PNG.')
        parser.add_argument('--saida', default='', help='pasta das saídas (padrão: docs/benchmark/ do projeto).')

    def handle(self, *args, **o):
        tamanhos, lista_workers = _lista(o['tamanhos']), _lista(o['workers'])
        if any(w > paralelo.MAX_WORKERS for w in lista_workers):
            raise CommandError(f'Workers devem ficar entre 1 e {paralelo.MAX_WORKERS}.')
        reps = o['repeticoes']
        if reps < 1:
            raise CommandError('--repeticoes deve ser maior que zero.')
        saida = o['saida'] or os.path.join(os.path.dirname(settings.BASE_DIR), 'docs', 'benchmark')
        os.makedirs(saida, exist_ok=True)

        inicio = time.perf_counter()
        resultado = {
            'gerado_em': datetime.now().astimezone().isoformat(timespec='seconds'),
            'ambiente': ambiente(),
            'parametros': {
                'tamanhos': tamanhos, 'workers': lista_workers, 'repeticoes': reps,
                'bloco': f'{LINHAS_POR_BLOCO} × {COLUNAS_POR_BLOCO} pares', 'perfis_com_embedding': '4 em cada 5',
                'dados': 'sintéticos em memória (metade buscando, metade oferecendo)',
                'blas_por_worker': 1,
            },
        }
        self.stdout.write(f"CPU: {resultado['ambiente']['cpu']} | núcleos: {resultado['ambiente']['nucleos_fisicos']} físicos, "
                          f"{resultado['ambiente']['nucleos_logicos']} lógicos | RAM livre: {resultado['ambiente']['ram_livre_mb']} MB")

        recalculo, pulados = self._recalculo(tamanhos, lista_workers, reps)
        resultado['recalculo'] = recalculo
        resultado['tamanhos_pulados'] = pulados
        resultado['amdahl'] = self._amdahl(recalculo)
        resultado['ponto_de_equilibrio'] = self._equilibrio(recalculo)
        resultado['embeddings'] = [] if o['sem_embeddings'] else self._embeddings(_lista(o['bios']), reps)
        resultado['ponta_a_ponta'] = self._ponta_a_ponta(_lista(o['tamanhos_banco']), max(1, o['repeticoes_banco'])) if o['banco_descartavel'] else []
        resultado['observacoes'] = self._observacoes(resultado)
        resultado['duracao_total_s'] = round(time.perf_counter() - inicio, 1)

        caminho_json = os.path.join(saida, 'paralelismo.json')
        with open(caminho_json, 'w', encoding='utf-8') as f:
            json.dump(resultado, f, ensure_ascii=False, indent=2)
        self._csv(resultado, os.path.join(saida, 'paralelismo.csv'))
        if not o['sem_grafico']:
            self._grafico(resultado, os.path.join(saida, 'paralelismo.png'))
        self.stdout.write('')
        for obs in resultado['observacoes']:
            self.stdout.write(f'  - {obs}')
        self.stdout.write(self.style.SUCCESS(f'\nArquivos em {saida} ({resultado["duracao_total_s"]} s).'))

    # ── A) recálculo ──────────────────────────────────────────────────────────

    def _cabe(self, n: int, workers_max: int) -> tuple[bool, str]:
        livre = paralelo.memoria_livre_mb()
        if livre is None:
            return True, ''
        pares = (n // 2) * (n - n // 2)
        dados = n * (384 * 4 + 150) / 2**20               # arrays dos perfis
        # principal: matriz uint16 (+ a do sequencial para comparar) + blocos em uso; cada worker: dados + ~120 MB
        necessario = 2 * pares * 2 / 2**20 + dados * 2 + 150 + workers_max * (dados * 2 + 120)
        if necessario > 0.7 * livre:
            return False, (f'N={n}: precisaria de ~{necessario:.0f} MB e há {livre:.0f} MB livres '
                           '(limite: 70% da memória livre).')
        return True, ''

    def _recalculo(self, tamanhos, lista_workers, reps):
        self.stdout.write('\nA) Recálculo em memória (dados sintéticos; nada é gravado)')
        # Aquecimento: imports, caches do BLAS e o primeiro pool de processos (arquivos do Python no cache do disco).
        a, b = grupo_sintetico(200, 1, 1), grupo_sintetico(200, 2, 10_000_000)
        for modo in paralelo.MODOS:
            paralelo.calcular_todos(a, b, modo, 2)

        linhas, pulados = [], []
        for n in tamanhos:
            ok, motivo = self._cabe(n, max(lista_workers))
            if not ok:
                pulados.append(motivo)
                self.stdout.write(self.style.WARNING(f'  pulado — {motivo}'))
                continue
            A, B = grupo_sintetico(n // 2, 1, 1), grupo_sintetico(n - n // 2, 2, 10_000_000)
            pares = len(A) * len(B)
            configs = [('sequencial', 1)] + [(m, w) for m in MODOS_PARALELOS for w in lista_workers]
            ref = None
            base = None
            paralelo.calcular_todos(A, B, 'sequencial', 1)  # aquecimento deste tamanho
            for modo, w in configs:
                tempos, memoria, hash_m, aviso = [], {}, None, ''
                for _ in range(reps):
                    r = paralelo.calcular_todos(A, B, modo, w)
                    tempos.append(r.tempo_s)
                    for pid, mb in r.memoria_workers_mb.items():
                        memoria[pid] = max(mb, memoria.get(pid, 0.0))
                    hash_m = hash_m or _hash(r.matriz)
                    aviso = aviso or r.aviso
                    if ref is None:
                        ref = r.matriz.copy()
                    elif not np.array_equal(r.matriz, ref):
                        raise CommandError(f'RESULTADO DIFERENTE do sequencial: N={n}, {modo}, {w} workers.')
                    del r
                med = statistics.median(tempos)
                base = med if modo == 'sequencial' else base
                speedup = base / med if med > 0 else None
                linha = {
                    'N': n, 'buscando': len(A), 'oferecendo': len(B), 'pares': pares, 'modo': modo, 'workers': w,
                    'tempo_mediana_s': round(med, 4), 'tempo_min_s': round(min(tempos), 4),
                    'tempos_s': [round(t, 4) for t in tempos],
                    'ns_por_par': round(med / pares * 1e9, 1),
                    'speedup': round(speedup, 3) if speedup else None,
                    'eficiencia': round(speedup / w, 3) if speedup else None,
                    'identico_ao_sequencial': True, 'hash_resultado': hash_m,
                    'memoria_principal_pico_mb': paralelo.pico_memoria_mb(),
                    'memoria_por_worker_mb': round(max(memoria.values()), 1) if memoria else None,
                    'aviso': aviso or None,
                }
                linhas.append(linha)
                self.stdout.write(f"  N={n:>6,} pares={pares:>11,} {modo:<10} w={w}  {med:8.3f} s  "
                                  f"speedup {linha['speedup']:.2f}  efic. {linha['eficiencia']:.2f}")
                self.stdout.flush()
            del A, B, ref
        return linhas, pulados

    @staticmethod
    def _amdahl(linhas):
        saida = []
        for n in sorted({x['N'] for x in linhas}):
            for modo in MODOS_PARALELOS:
                pontos = [(x['workers'], x['speedup']) for x in linhas
                          if x['N'] == n and x['modo'] == modo and x['speedup']]
                p = ajustar_amdahl(pontos)
                if p is None:
                    continue
                saida.append({'N': n, 'modo': modo, 'fracao_paralelizavel': p,
                              'speedup_maximo_teorico': round(1 / (1 - p), 2) if p < 1 else None,
                              'pontos': [{'workers': w, 'speedup': s} for w, s in pontos]})
        return saida

    @staticmethod
    def _equilibrio(linhas):
        """Menor N (dos medidos) em que o melhor resultado com 2+ workers supera o sequencial."""
        saida = {}
        for modo in MODOS_PARALELOS:
            melhor_por_n = {}
            for x in linhas:
                if x['modo'] == modo and x['workers'] > 1 and x['speedup']:
                    atual = melhor_por_n.get(x['N'])
                    if atual is None or x['speedup'] > atual['speedup']:
                        melhor_por_n[x['N']] = x
            vale = [n for n in sorted(melhor_por_n) if melhor_por_n[n]['speedup'] > 1.05]
            # "passa a valer a pena": a partir do primeiro N em que ganha e continua ganhando nos maiores
            n_min = next((n for n in vale if all(m in vale for m in sorted(melhor_por_n) if m >= n)), None)
            saida[modo] = {
                'N_minimo': n_min,
                'pares_minimo': melhor_por_n[n_min]['pares'] if n_min else None,
                'ganhou_em_N': vale,
                'perdeu_ou_empatou_em_N': [n for n in sorted(melhor_por_n) if n not in vale],
                'melhor_por_N': {str(n): {'workers': x['workers'], 'speedup': x['speedup']} for n, x in melhor_por_n.items()},
            }
        return saida

    # ── B) embeddings ─────────────────────────────────────────────────────────

    def _embeddings(self, quantidades, reps):
        from ia import servico
        from perfis.management.commands.seed_perfis import SEED_USERS

        self.stdout.write('\nB) gerar_embeddings (modelo real; nada é gravado)')
        if servico.usando_falso() or not servico.habilitada() or not servico.modelo_baixado():
            self.stdout.write(self.style.WARNING('  pulado — IA desligada ou modelo não baixado (python manage.py baixar_modelo_ia).'))
            return []
        if servico.obter_embedder() is None:
            self.stdout.write(self.style.WARNING('  pulado — o modelo não carregou.'))
            return []
        bios = [u[3]['bio'] for u in SEED_USERS if u[3].get('bio')]
        linhas = []
        for qtd in quantidades:
            textos = [f'{bios[i % len(bios)]} (perfil {i})' for i in range(qtd)]
            servico.gerar_vetores(textos[:5])  # aquecimento
            ref, base = None, None
            for w in (1, 2):
                tempos = []
                for _ in range(reps):
                    t = time.perf_counter()
                    v = servico.gerar_vetores(textos, workers=w)
                    tempos.append(time.perf_counter() - t)
                    if v is None:
                        raise CommandError('Falha ao gerar os embeddings (veja o log).')
                    if ref is None:
                        ref = v
                    elif not np.array_equal(v, ref):
                        raise CommandError(f'Embeddings DIFERENTES com {w} workers ({qtd} bios).')
                med = statistics.median(tempos)
                base = med if w == 1 else base
                linha = {'bios': qtd, 'workers': w, 'tempo_mediana_s': round(med, 3), 'tempos_s': [round(t, 3) for t in tempos],
                         'ms_por_bio': round(med * 1000 / qtd, 1), 'speedup': round(base / med, 3),
                         'eficiencia': round(base / med / w, 3), 'identico_ao_sequencial': True}
                linhas.append(linha)
                self.stdout.write(f"  {qtd:>4} bios  w={w}  {med:7.2f} s  ({linha['ms_por_bio']} ms/bio)  speedup {linha['speedup']:.2f}")
                self.stdout.flush()
        return linhas

    # ── C) ponta a ponta (banco descartável) ─────────────────────────────────

    def _ponta_a_ponta(self, tamanhos, reps):
        from django.contrib.auth.hashers import make_password

        from ia import servico
        from ia.models import EmbeddingPerfil
        from matches import processamento
        from matches.management.commands.benchmark_compatibilidade import _perfil_db, _vetor_ia
        from matches.models import Compatibilidade
        from perfis.models import Perfil
        from usuarios.models import Usuario

        self.stdout.write('\nC) Ponta a ponta no banco descartável (carregar + calcular + gravar)')
        if Usuario.objects.exists():
            raise CommandError('--banco-descartavel: o banco tem usuários. Use um banco VAZIO (descartável); '
                               'nada foi criado nem apagado.')
        linhas = []
        try:
            for n in tamanhos:
                Usuario.objects.all().delete()
                us = Usuario.objects.bulk_create([
                    Usuario(username=f'_par_{i}', email=f'_par_{i}@benchmark.local', password=make_password(None),
                            tipo='buscando_vaga' if i % 2 else 'oferecendo_vaga') for i in range(n)], batch_size=1000)
                Perfil.objects.bulk_create([_perfil_db(u, i) for i, u in enumerate(us)], batch_size=1000)
                EmbeddingPerfil.objects.bulk_create([
                    EmbeddingPerfil(perfil_id=pid, vetor=EmbeddingPerfil.empacotar(v), modelo=servico.nome_modelo(),
                                    hash_texto='-' * 64, temas=[])
                    for pid in Perfil.objects.values_list('id', flat=True) if (v := _vetor_ia(pid)) is not None
                ], batch_size=1000)
                configs = [('sequencial', 1), ('threads', 2), ('processos', 2), ('processos', 4)]
                base = None
                for modo, w in configs:
                    fases = []
                    for _ in range(reps):
                        Compatibilidade.objects.all().delete()  # transação própria (autocommit)
                        fases.append(processamento.recalcular_todas(modo, w))
                    med = {k: statistics.median(f[k] for f in fases)
                           for k in ('tempo_carregar_s', 'tempo_calcular_s', 'tempo_gravar_s', 'tempo_total_s')}
                    base = med['tempo_total_s'] if modo == 'sequencial' else base
                    seq_frac = (med['tempo_carregar_s'] + med['tempo_gravar_s']) / med['tempo_total_s']
                    linha = {'N': n, 'pares': fases[0]['pares'], 'modo': modo, 'workers': w,
                             **{k: round(v, 3) for k, v in med.items()},
                             'fracao_sequencial_banco': round(seq_frac, 3),
                             'speedup_total': round(base / med['tempo_total_s'], 3)}
                    linhas.append(linha)
                    self.stdout.write(f"  N={n:>5} {modo:<10} w={w} carregar {med['tempo_carregar_s']:.2f} s · calcular "
                                      f"{med['tempo_calcular_s']:.2f} s · gravar {med['tempo_gravar_s']:.2f} s · total "
                                      f"{med['tempo_total_s']:.2f} s (speedup {linha['speedup_total']:.2f})")
                    self.stdout.flush()
        finally:
            Compatibilidade.objects.all().delete()
            Usuario.objects.all().delete()
        return linhas

    # ── conclusões automáticas ───────────────────────────────────────────────

    @staticmethod
    def _observacoes(r):
        obs = []
        carga = r['ambiente'].get('carga_cpu_fundo_pct')
        carga = carga if carga is not None else r['ambiente'].get('carga_cpu_inicio_pct')
        if carga is not None and carga >= 30:
            obs.append(f'A CPU já tinha {carga}% de uso de outros programas no início: o ganho medido é menor que o de '
                       'uma máquina ociosa e os tempos variam entre repetições.')
        for modo in MODOS_PARALELOS:
            eq = r['ponto_de_equilibrio'].get(modo, {})
            if not eq.get('melhor_por_N'):
                continue
            melhores = ', '.join(f"N = {_br(int(n))}: {x['speedup']:.2f} ({x['workers']} workers)"
                                 for n, x in eq['melhor_por_N'].items())
            if eq.get('N_minimo'):
                texto = f"compensa a partir de N = {_br(eq['N_minimo'])} perfis ({_br(eq['pares_minimo'])} pares)"
            elif eq.get('ganhou_em_N'):
                texto = ('ganhou em N = ' + ', '.join(_br(n) for n in eq['ganhou_em_N']) + ' e não em N = '
                         + ', '.join(_br(n) for n in eq['perdeu_ou_empatou_em_N']))
            else:
                texto = 'não superou o sequencial em nenhum tamanho medido'
            obs.append(f'{modo.capitalize()}: {texto}. Melhor speedup por tamanho: {melhores}.')
        com_speedup = [x for x in r['recalculo'] if x['speedup'] and x['modo'] != 'sequencial']
        if com_speedup:
            melhor = max(com_speedup, key=lambda x: x['speedup'])
            obs.append(f"Melhor resultado: N = {_br(melhor['N'])}, {melhor['modo']} com {melhor['workers']} workers, "
                       f"speedup {melhor['speedup']:.2f} (eficiência {melhor['eficiencia']:.2f}).")
        for modo in MODOS_PARALELOS:
            pontos = [a for a in r['amdahl'] if a['modo'] == modo]
            if pontos:
                a = max(pontos, key=lambda x: x['fracao_paralelizavel'])
                obs.append(f"Amdahl ({modo}): maior fração paralelizável estimada p = {a['fracao_paralelizavel']:.2f} em "
                           f"N = {_br(a['N'])}" + (f" (speedup máximo teórico ~ {a['speedup_maximo_teorico']:.1f})."
                                                   if a['speedup_maximo_teorico'] else '.'))
        for qtd in sorted({x['bios'] for x in r['embeddings']}):
            dois = next((x for x in r['embeddings'] if x['bios'] == qtd and x['workers'] == 2), None)
            if dois:
                obs.append(f"Embeddings, {qtd} bios: 2 workers {'mais rápido' if dois['speedup'] > 1 else 'mais lento'} que 1 "
                           f"(speedup {dois['speedup']:.2f}; cada worker carrega o modelo).")
        if r['tamanhos_pulados']:
            obs.append('Pulados por memória: ' + ' '.join(r['tamanhos_pulados']))
        return obs

    # ── arquivos ─────────────────────────────────────────────────────────────

    def _csv(self, r, caminho):
        campos = ['secao', 'N', 'pares', 'bios', 'modo', 'workers', 'tempo_mediana_s', 'tempo_min_s', 'speedup',
                  'eficiencia', 'identico_ao_sequencial', 'memoria_principal_pico_mb', 'memoria_por_worker_mb',
                  'tempo_carregar_s', 'tempo_calcular_s', 'tempo_gravar_s', 'fracao_sequencial_banco']
        with open(caminho, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=campos, extrasaction='ignore')
            w.writeheader()
            for x in r['recalculo']:
                w.writerow({'secao': 'recalculo_memoria', **x})
            for x in r['embeddings']:
                w.writerow({'secao': 'embeddings', 'modo': 'fastembed_parallel' if x['workers'] > 1 else 'sequencial', **x})
            for x in r['ponta_a_ponta']:
                w.writerow({'secao': 'ponta_a_ponta_banco', 'tempo_mediana_s': x['tempo_total_s'],
                            'speedup': x['speedup_total'], **x})
        self.stdout.write(f'  -> {caminho}')

    def _grafico(self, r, caminho):
        try:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
        except ImportError:
            self.stdout.write(self.style.WARNING('  gráfico não gerado: instale o matplotlib (requirements-dev.txt).'))
            return
        linhas = r['recalculo']
        if not linhas:
            return
        # Paleta categórica validada (ordem fixa; cor segue o N, nunca a posição) + texto em tinta neutra.
        cores = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6', '#008300', '#e34948']
        marcadores = ['o', 's', '^', 'D', 'v', 'P', 'X', '*']
        tinta, tinta2, grade, fundo = '#0b0b0b', '#52514e', '#e4e3df', '#fcfcfb'
        tamanhos = sorted({x['N'] for x in linhas})
        workers = sorted({x['workers'] for x in linhas if x['modo'] != 'sequencial'})
        n_max = tamanhos[-1]

        plt.rcParams.update({'font.size': 9, 'axes.edgecolor': grade, 'axes.labelcolor': tinta2,
                             'xtick.color': tinta2, 'ytick.color': tinta2, 'text.color': tinta})
        fig, eixos = plt.subplots(1, 3, figsize=(15, 4.8), facecolor=fundo)
        for ax in eixos:
            ax.set_facecolor(fundo)
            ax.grid(True, color=grade, linewidth=0.8)
            ax.set_axisbelow(True)
            for lado in ('top', 'right'):
                ax.spines[lado].set_visible(False)
            ax.set_xticks(workers)
            ax.set_xlabel('workers')

        # 1) tempo × workers no maior N
        ax = eixos[0]
        seq = next(x for x in linhas if x['N'] == n_max and x['modo'] == 'sequencial')
        ax.axhline(seq['tempo_mediana_s'], color=tinta2, linestyle='--', linewidth=1.5)
        ax.annotate(f"sequencial {seq['tempo_mediana_s']:.1f} s", (workers[0], seq['tempo_mediana_s']),
                    textcoords='offset points', xytext=(4, 5), ha='left', color=tinta2)
        for i, modo in enumerate(MODOS_PARALELOS):
            pts = sorted((x['workers'], x['tempo_mediana_s']) for x in linhas if x['N'] == n_max and x['modo'] == modo)
            if pts:
                xs, ys = zip(*pts)
                ax.plot(xs, ys, color=cores[i], marker=marcadores[i], markersize=7, linewidth=2, label=modo)
                ax.annotate(f'{modo} {ys[-1]:.1f} s', (xs[-1], ys[-1]), textcoords='offset points', xytext=(6, -3), color=tinta)
        ax.set_ylim(bottom=0)
        ax.set_ylabel('tempo (s, mediana)')
        ax.set_title(f'Tempo × workers — N = {_br(n_max)} perfis ({_br(seq["pares"])} pares)', color=tinta, loc='left')
        ax.legend(frameon=False, loc='lower left')

        # 2) e 3) speedup × workers, uma linha por N
        for ax, modo in zip(eixos[1:], MODOS_PARALELOS):
            ax.plot(workers, workers, color=tinta2, linestyle=':', linewidth=1.5, label='ideal (speedup = workers)')
            ax.axhline(1.0, color=grade, linewidth=1.2)
            finais = []
            for i, n in enumerate(tamanhos):
                pts = sorted((x['workers'], x['speedup']) for x in linhas if x['N'] == n and x['modo'] == modo and x['speedup'])
                if not pts:
                    continue
                xs, ys = zip(*pts)
                ax.plot(xs, ys, color=cores[i % len(cores)], marker=marcadores[i % len(marcadores)], markersize=7,
                        linewidth=2, label=f'N = {_br(n)}')
                finais.append((ys[-1], xs[-1]))
            # rótulos do último ponto sem sobreposição (afasta os vizinhos pelo menos 0,14 no eixo y)
            ultimo = None
            for y, x in sorted(finais):
                pos = y if ultimo is None else max(y, ultimo + 0.14)
                ax.annotate(f'{y:.2f}', xy=(x, y), xytext=(x + 0.08, pos), textcoords='data', color=tinta,
                            ha='left', va='center', fontsize=8)
                ultimo = pos
            ax.set_ylim(0, max(workers) + 0.3)
            ax.set_ylabel('speedup (sequencial ÷ paralelo)')
            ax.set_title(f'Speedup × workers — {modo}', color=tinta, loc='left')
            ax.legend(frameon=False, loc='upper left', fontsize=8)

        amb = r['ambiente']
        fig.suptitle(f"Recálculo de compatibilidades em paralelo — {amb['cpu']} ({amb['nucleos_fisicos']} núcleos físicos, "
                     f"{amb['nucleos_logicos']} lógicos); mediana de {r['parametros']['repeticoes']} repetições",
                     color=tinta, fontsize=10, x=0.01, ha='left')
        fig.tight_layout()
        fig.savefig(caminho, dpi=130, facecolor=fundo)
        plt.close(fig)
        self.stdout.write(f'  -> {caminho}')
