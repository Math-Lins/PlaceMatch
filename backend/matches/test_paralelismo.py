"""
Recálculo em paralelo (matches/algoritmo/matriz.py, paralelo.py e processamento.py), o comando
recalcular_compatibilidades, o benchmark_paralelismo e GET /api/admin/processamento/benchmark/.

Regra obrigatória: com QUALQUER modo e número de workers, o resultado é IDÊNTICO ao sequencial — e ao
cálculo escalar/vetorial usado no dia a dia (salvar perfil).
"""
import json
import os
import random
import tempfile
from io import StringIO
from types import SimpleNamespace
from unittest import mock

import numpy as np
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APITestCase

from ia.models import EmbeddingPerfil
from ia.tests.apoio import BIO_CULINARIA, BIO_CULINARIA_2, BIO_CURTA, BIO_FESTAS, criar
from matches import processamento
from matches.algoritmo import calcular_score, calcular_scores_lote, matriz, paralelo
from matches.algoritmo.matriz import arredondar4, montar_grupo
from matches.management.commands.benchmark_paralelismo import ajustar_amdahl, grupo_sintetico
from matches.models import Compatibilidade
from usuarios.models import Usuario

_HORARIOS = ['madrugador', 'noturno', 'flexivel', 'invalido']
_VISITAS = ['raramente', 'as_vezes', 'frequentemente']
_IMOVEIS = ['apartamento', 'casa', 'republica', 'indiferente']
_REGIOES = ['Boa Viagem', ' boa viagem ', 'Recife', 'Olinda', 'Graças']


def _perfil(pid, rng, sem_vetor=False):
    """Perfil leve com valores que testam os arredondamentos (orçamentos 'quebrados', regiões com espaços)."""
    orc_min = rng.choice([500, 800, 812.5, 1000, 1333.33, 2000])
    vetor = None
    if not sem_vetor and pid % 4:
        g = np.random.default_rng(pid)
        v = g.standard_normal(384) + 3.0 * np.random.default_rng(7).standard_normal(384) * g.uniform(0, 1)
        vetor = (v / np.linalg.norm(v)).astype('<f4')
    return SimpleNamespace(
        id=pid, orcamento_min=orc_min, orcamento_max=orc_min + rng.choice([0, 1, 250, 499.99, 700, 1500]),
        regiao=rng.choice(_REGIOES), fumante=rng.random() < 0.3, aceita_pets=rng.random() < 0.5,
        tolerancia_bagunca=rng.randint(1, 5), nivel_organizacao=rng.randint(1, 5),
        perfil_horario=rng.choice(_HORARIOS), nivel_ruido=rng.randint(1, 5), nivel_social=rng.randint(1, 5),
        aceita_visitas=rng.choice(_VISITAS), tipo_imovel=rng.choice(_IMOVEIS), qtd_moradores=rng.randint(1, 4),
        idade=rng.randint(18, 70),
        # o mesmo vetor que o banco devolve (float32 → float64), lido por vetor_do_perfil
        vetor_ia=None if vetor is None else vetor.astype(np.float64), _vetor32=vetor,
    )


def _grupos(perfis_a, perfis_b):
    def d(p):
        x = {k: v for k, v in vars(p).items() if not k.startswith('_')}
        x['vetor'] = p._vetor32
        return x
    regioes = {}
    return montar_grupo([d(p) for p in perfis_a], regioes), montar_grupo([d(p) for p in perfis_b], regioes)


class _BlocosPequenos:
    """Blocos de 7 × 11 pares: com poucos perfis já existem muitos blocos (e muitas tarefas por worker)."""

    def setUp(self):
        super().setUp()
        p1 = mock.patch.object(matriz, 'LINHAS_POR_BLOCO', 7)
        p2 = mock.patch.object(matriz, 'COLUNAS_POR_BLOCO', 11)
        p3 = mock.patch.object(paralelo, 'BLOCOS_POR_TAREFA', 3)
        for p in (p1, p2, p3):
            p.start()
            self.addCleanup(p.stop)


class ArredondamentoExatoTest(SimpleTestCase):
    def test_igual_ao_round_do_python_inclusive_nos_empates(self):
        rng = np.random.default_rng(1)
        base = np.concatenate([
            rng.uniform(-1, 1, 20000),
            (np.arange(0, 10001) + 0.5) / 10000,                       # empates exatos em 4 casas
            np.nextafter((np.arange(0, 10001) + 0.5) / 10000, 2),      # 1 ULP acima
            np.nextafter((np.arange(0, 10001) + 0.5) / 10000, -2),     # 1 ULP abaixo
            np.array([0.0, -0.0, 1.0, -1.0, 0.12345, 0.00005, 0.99995, -0.00005]),
        ])
        esperado = np.array([round(float(v), 4) for v in base])
        self.assertTrue(np.array_equal(arredondar4(base), esperado))


class EquivalenciaModosTest(_BlocosPequenos, SimpleTestCase):
    """Matriz × escalar × vetorial e sequencial × threads × processos com 1, 2 e 3 workers: igualdade exata."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        rng = random.Random(2026)
        cls.a = [_perfil(i, rng) for i in range(1, 41)]
        cls.b = [_perfil(i, rng) for i in range(100, 157)]

    def test_matriz_igual_ao_vetorial_e_ao_escalar(self):
        A, B = _grupos(self.a, self.b)
        res = paralelo.calcular_todos(A, B, 'sequencial', 1)
        esperado_vetorial = np.array([calcular_scores_lote(pa, self.b)[1] for pa in self.a])
        esperado_escalar = np.array([[calcular_score(pa, pb) for pb in self.b] for pa in self.a])
        self.assertTrue(np.array_equal(res.matriz / 10000, esperado_vetorial))
        self.assertTrue(np.array_equal(res.matriz / 10000, esperado_escalar))
        # e o arredondamento em inteiro é exato: k / 10000 == round(score, 4)
        self.assertEqual([k / 10000 for k in res.matriz[0].tolist()], [round(s, 4) for s in esperado_escalar[0]])

    def test_sequencial_threads_e_processos_com_1_2_e_3_workers_sao_identicos(self):
        A, B = _grupos(self.a, self.b)
        ref = paralelo.calcular_todos(A, B, 'sequencial', 1)
        self.assertGreater(len(matriz.blocos(len(A), len(B))), 20)
        for modo in ('threads', 'processos'):
            for workers in (1, 2, 3):
                with self.subTest(modo=modo, workers=workers):
                    r = paralelo.calcular_todos(A, B, modo, workers)
                    self.assertEqual((r.modo, r.workers, r.aviso), (modo, workers, ''))
                    self.assertTrue(np.array_equal(r.matriz, ref.matriz))
                    if modo == 'processos':
                        self.assertTrue(r.memoria_workers_mb)  # pico de memória de cada worker

    def test_sem_ia_e_pesos_personalizados(self):
        A, B = _grupos(self.a, self.b)
        pesos = {'orcamento': 0.3, 'regiao': 0.1, 'rotina': 0.1, 'habitos': 0.3, 'moradia': 0.05, 'idade': 0.05,
                 'afinidade_ia': 0.1}
        for com_ia in (True, False):
            ref = paralelo.calcular_todos(A, B, 'sequencial', 1, pesos=pesos, com_ia=com_ia)
            thr = paralelo.calcular_todos(A, B, 'threads', 2, pesos=pesos, com_ia=com_ia)
            self.assertTrue(np.array_equal(ref.matriz, thr.matriz))
        self.assertEqual(int(ref.matriz[0, 0]), round(calcular_score(self.a[0], SimpleNamespace(**{
            **vars(self.b[0]), 'vetor_ia': None}), pesos) * 10000))

    def test_grupos_vazios(self):
        A, B = _grupos(self.a, [])
        r = paralelo.calcular_todos(A, B, 'processos', 2)
        self.assertEqual(r.matriz.shape, (40, 0))

    def test_divisao_em_blocos_nao_depende_dos_workers(self):
        self.assertEqual(matriz.blocos(15, 23)[:3], [(0, 7, 0, 11), (0, 7, 11, 22), (0, 7, 22, 23)])
        self.assertEqual(sum((i1 - i0) * (j1 - j0) for i0, i1, j0, j1 in matriz.blocos(15, 23)), 15 * 23)


class FalhaDoPoolTest(SimpleTestCase):
    def setUp(self):
        rng = random.Random(5)
        self.A, self.B = _grupos([_perfil(i, rng) for i in range(1, 9)], [_perfil(i, rng) for i in range(50, 60)])
        self.ref = paralelo.calcular_todos(self.A, self.B, 'sequencial', 1).matriz

    def test_processos_que_nao_sobem_caem_para_sequencial_com_aviso(self):
        with mock.patch.object(paralelo, 'ProcessPoolExecutor', side_effect=OSError('sem permissão para criar processos')), \
                self.assertLogs('matches.processamento', 'WARNING') as logs:
            r = paralelo.calcular_todos(self.A, self.B, 'processos', 2)
        self.assertEqual((r.modo, r.workers, r.modo_pedido), ('sequencial', 1, 'processos'))
        self.assertIn('refeito no modo sequencial', r.aviso)
        self.assertIn('sem permissão', logs.output[0])
        self.assertTrue(np.array_equal(r.matriz, self.ref))

    def test_worker_que_morre_no_meio(self):
        from concurrent.futures.process import BrokenProcessPool

        def quebrar(*a, **k):
            raise BrokenProcessPool('um worker morreu')

        # Pool de threads com a mesma interface no lugar do de processos, para o mock valer dentro das tarefas.
        with mock.patch.object(paralelo, '_tarefa_processo', side_effect=quebrar),                 self.assertLogs('matches.processamento', 'WARNING') as logs:
            r = _sem_kwargs_de_processo(lambda: paralelo.calcular_todos(self.A, self.B, 'processos', 2))
        self.assertIn('BrokenProcessPool', logs.output[0])
        self.assertEqual(r.modo, 'sequencial')
        self.assertTrue(np.array_equal(r.matriz, self.ref))

    def test_threads_com_erro_tambem_caem_para_sequencial(self):
        original = paralelo.calcular_bloco
        chamadas = []

        def falhar_na_thread(*a, **k):
            import threading
            if threading.current_thread().name.startswith('recalculo'):
                raise MemoryError('sem memória')
            chamadas.append(1)
            return original(*a, **k)

        with mock.patch.object(paralelo, 'calcular_bloco', side_effect=falhar_na_thread), \
                self.assertLogs('matches.processamento', 'WARNING'):
            r = paralelo.calcular_todos(self.A, self.B, 'threads', 2)
        self.assertEqual(r.modo, 'sequencial')
        self.assertTrue(chamadas)
        self.assertTrue(np.array_equal(r.matriz, self.ref))


def _sem_kwargs_de_processo(fn):
    """O ThreadPoolExecutor não aceita mp_context/initializer de processo: troca a criação por um que ignora."""
    from concurrent.futures import ThreadPoolExecutor

    class _Pool(ThreadPoolExecutor):
        def __init__(self, max_workers=None, mp_context=None, initializer=None, initargs=()):
            super().__init__(max_workers=max_workers)

    with mock.patch.object(paralelo, 'ProcessPoolExecutor', _Pool):
        return fn()


class ValidacaoTest(SimpleTestCase):
    def test_modo_e_workers_invalidos(self):
        for modo, workers in [('gpu', 2), ('processos', 0), ('threads', 17), ('threads', 2.5), ('threads', True),
                              ('sequencial', -1)]:
            with self.subTest(modo=modo, workers=workers), self.assertRaises(ValueError):
                paralelo.validar(modo, workers)
        with self.assertRaises(ValueError):
            processamento.recalcular_todas('rapido', 2)

    def test_workers_padrao(self):
        padrao = max(1, min(4, os.cpu_count() or 1))
        for valor, esperado in [(None, padrao), ('', padrao), ('abc', padrao), ('0', padrao), ('99', padrao),
                                ('3', 3), (2, 2)]:
            with self.subTest(valor=valor), override_settings(PROCESSAMENTO_WORKERS=valor):
                self.assertEqual(processamento.workers_padrao(), esperado)

    def test_auto_escolhe_pelo_numero_de_pares(self):
        limiar = processamento.LIMIAR_PARES_PARALELO
        self.assertEqual(processamento.escolher_modo('auto', limiar - 1), 'sequencial')
        self.assertEqual(processamento.escolher_modo('auto', limiar), 'threads')
        self.assertEqual(processamento.escolher_modo('threads', 1), 'threads')

    def test_amdahl(self):
        # p = 0,9: S(2) = 1/(0,1 + 0,45) e S(4) = 1/(0,1 + 0,225)
        self.assertAlmostEqual(ajustar_amdahl([(2, 1 / 0.55), (4, 1 / 0.325)]), 0.9, places=4)
        self.assertEqual(ajustar_amdahl([(1, 1.0)]), None)
        self.assertEqual(ajustar_amdahl([(2, 0.5)]), 0.0)  # mais lento que o sequencial: nada paralelizável

    def test_grupo_sintetico_deterministico(self):
        a, b = grupo_sintetico(30, 1, 1), grupo_sintetico(30, 1, 1)
        self.assertTrue(np.array_equal(a.vetores, b.vetores))
        self.assertEqual(int(a.tem_vetor.sum()), 24)


class ComandoRecalcularTest(_BlocosPequenos, TestCase):
    """recalcular_compatibilidades no banco: mesmos scores do cálculo feito ao salvar cada perfil."""

    def setUp(self):
        super().setUp()
        bios = [BIO_CULINARIA, BIO_CULINARIA_2, BIO_FESTAS, BIO_CURTA]
        for i in range(9):
            criar('buscando_vaga', bios[i % 4], idade=18 + 3 * i, orcamento_min=500 + 70 * i, orcamento_max=1500 + 33 * i,
                  regiao=['Recife', 'Olinda', 'Graças'][i % 3], nivel_ruido=1 + i % 5)
        for i in range(13):
            criar('oferecendo_vaga', bios[(i + 1) % 4], idade=20 + 2 * i, orcamento_min=600 + 55 * i,
                  orcamento_max=1200 + 91 * i, regiao=['Recife', 'Graças'][i % 2], fumante=bool(i % 3 == 0))
        self.assertGreater(EmbeddingPerfil.objects.count(), 10)
        # o signal recalculou cada perfil ao salvar (recalcular_lote): esses são os valores de referência
        self.ref = {(a, b): sc for a, b, sc in Compatibilidade.objects.values_list('perfil_a_id', 'perfil_b_id', 'score')}
        self.assertEqual(len(self.ref), 9 * 13)

    def _rodar(self, *args):
        saida, erro = StringIO(), StringIO()
        Compatibilidade.objects.all().delete()
        call_command('recalcular_compatibilidades', *args, stdout=saida, stderr=erro)
        atual = {(a, b): s for a, b, s in Compatibilidade.objects.values_list('perfil_a_id', 'perfil_b_id', 'score')}
        return saida.getvalue(), erro.getvalue(), atual

    def test_todos_os_modos_gravam_os_mesmos_scores_do_signal(self):
        for args in (['--modo', 'sequencial'], ['--modo', 'threads', '--workers', '3'],
                     ['--modo', 'processos', '--workers', '2'], ['--metodo', 'loop'], []):
            with self.subTest(args=args):
                saida, _, atual = self._rodar(*args)
                self.assertEqual(atual, self.ref)
                self.assertIn('Concluído', saida)

    def test_saida_mostra_pares_modo_e_fases(self):
        saida, _, _ = self._rodar('--modo', 'threads', '--workers', '2')
        self.assertIn('9 buscando × 13 oferecendo = 117 pares', saida)
        self.assertIn('modo threads (2 workers)', saida)
        self.assertIn('gravar', saida)

    def test_auto_com_poucos_pares_usa_sequencial_sem_criar_processos(self):
        with mock.patch.object(paralelo, 'ProcessPoolExecutor', side_effect=AssertionError('não deveria criar')):
            saida, _, atual = self._rodar()
        self.assertIn('modo sequencial (1 worker), pedido: auto', saida)
        self.assertEqual(atual, self.ref)

    def test_falha_do_pool_cai_para_sequencial_e_avisa(self):
        with mock.patch.object(paralelo, 'ProcessPoolExecutor', side_effect=OSError('pool quebrado')), \
                self.assertLogs('matches.processamento', 'WARNING'):
            saida, erro, atual = self._rodar('--modo', 'processos', '--workers', '2')
        self.assertIn('Aviso:', erro)
        self.assertIn('modo sequencial (1 worker), pedido: processos', saida)
        self.assertEqual(atual, self.ref)

    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada_usa_os_6_criterios(self):
        saida, _, atual = self._rodar('--modo', 'threads', '--workers', '2')
        self.assertIn('sem o ThoLuk', saida)
        _, _, seq = self._rodar('--metodo', 'loop')
        self.assertEqual(atual, seq)

    def test_opcoes_invalidas(self):
        for args in (['--workers', '0'], ['--workers', '17'], ['--modo', 'gpu'], ['--workers', 'dois']):
            with self.subTest(args=args), self.assertRaises(CommandError):
                call_command('recalcular_compatibilidades', *args, stdout=StringIO(), stderr=StringIO())

    def test_carregar_faz_2_consultas(self):
        with self.assertNumQueries(2):
            A, B, com_ia = processamento.carregar()
        self.assertEqual((len(A), len(B), com_ia), (9, 13, True))


class BenchmarkParalelismoTest(TestCase):
    def test_gera_json_e_csv_com_resultados_identicos(self):
        with tempfile.TemporaryDirectory() as pasta:
            call_command('benchmark_paralelismo', '--tamanhos', '60,120', '--workers', '1,2', '--repeticoes', '1',
                         '--sem-embeddings', '--sem-grafico', '--saida', pasta, stdout=StringIO())
            with open(os.path.join(pasta, 'paralelismo.json'), encoding='utf-8') as f:
                dados = json.load(f)
            self.assertTrue(os.path.exists(os.path.join(pasta, 'paralelismo.csv')))
        self.assertEqual(len(dados['recalculo']), 2 * (1 + 2 * 2))  # 2 tamanhos × (sequencial + 2 modos × 2 workers)
        self.assertTrue(all(x['identico_ao_sequencial'] for x in dados['recalculo']))
        self.assertEqual(len({x['hash_resultado'] for x in dados['recalculo'] if x['N'] == 60}), 1)
        for chave in ('ambiente', 'parametros', 'amdahl', 'ponto_de_equilibrio', 'observacoes', 'embeddings'):
            self.assertIn(chave, dados)
        self.assertIn('nucleos_logicos', dados['ambiente'])
        seq = next(x for x in dados['recalculo'] if x['modo'] == 'sequencial')
        self.assertEqual((seq['speedup'], seq['eficiencia'], seq['pares']), (1.0, 1.0, 30 * 30))

    def test_resumo_curto_em_portugues(self):
        import re
        from matches.management.commands.benchmark_paralelismo import Command as Bench
        linhas = [
            {'N': n, 'pares': n * n // 4, 'modo': m, 'workers': w, 'speedup': sp, 'eficiencia': sp / w}
            for n, m, w, sp in [(1000, 'sequencial', 1, 1.0), (1000, 'threads', 2, 1.8), (1000, 'processos', 2, 0.1),
                                (5000, 'sequencial', 1, 1.0), (5000, 'threads', 2, 2.4), (5000, 'processos', 2, 1.3)]
        ]
        r = {'recalculo': linhas, 'amdahl': Bench._amdahl(linhas), 'ponto_de_equilibrio': Bench._equilibrio(linhas),
             'ponta_a_ponta': [{'modo': 'sequencial', 'pares': 250000, 'tempo_gravar_s': 39.95, 'tempo_total_s': 40.1}]}
        itens = Bench._resumo(r)
        self.assertLessEqual(len(itens), 5)
        texto = ' '.join(itens)
        self.assertIn('2,40× mais rápido', texto)
        self.assertIn('Threads compensam a partir de 1.000 perfis', texto)
        self.assertIn('Processos compensam a partir de 5.000 perfis', texto)
        self.assertIn('Lei de Amdahl', texto)
        self.assertIn('99,6% do tempo', texto)
        self.assertIsNone(re.search(r'\d\.\d{1,2}(?!\d)', texto), 'número com ponto decimal no resumo')

    def test_opcoes_invalidas(self):
        for args in (['--tamanhos', 'mil'], ['--tamanhos', '0'], ['--workers', '1,99'], ['--repeticoes', '0']):
            with self.subTest(args=args), self.assertRaises(CommandError):
                call_command('benchmark_paralelismo', *args, '--sem-embeddings', '--sem-grafico', stdout=StringIO())

    def test_banco_descartavel_recusa_banco_com_usuarios_sem_apagar_nada(self):
        criar('buscando_vaga', BIO_CULINARIA)
        with tempfile.TemporaryDirectory() as pasta, self.assertRaisesMessage(CommandError, 'VAZIO'):
            call_command('benchmark_paralelismo', '--tamanhos', '20', '--workers', '2', '--repeticoes', '1',
                         '--sem-embeddings', '--sem-grafico', '--banco-descartavel', '--saida', pasta, stdout=StringIO())
        self.assertEqual(Usuario.objects.count(), 1)

    def test_benchmark_compatibilidade_tambem_exige_banco_vazio(self):
        criar('buscando_vaga', BIO_CULINARIA)
        with self.assertRaisesMessage(CommandError, 'VAZIO'):
            call_command('benchmark_compatibilidade', '--banco-descartavel', '--repeticoes', '1', stdout=StringIO())
        self.assertEqual(Usuario.objects.count(), 1)


class BenchmarkEndpointTest(APITestCase):
    URL = '/api/admin/processamento/benchmark/'

    def setUp(self):
        self.admin = Usuario.objects.create_user(username='adm', email='adm@t.com', password='Senha@Forte123',
                                                 tipo='administrador')
        self.comum, _ = criar('buscando_vaga', BIO_CULINARIA)
        self.pasta = tempfile.TemporaryDirectory()
        self.addCleanup(self.pasta.cleanup)
        self.arquivo = os.path.join(self.pasta.name, 'paralelismo.json')

    def _get(self, usuario=None):
        if usuario:
            self.client.force_authenticate(usuario)
        with override_settings(PROCESSAMENTO_BENCHMARK_ARQUIVO=self.arquivo):
            return self.client.get(self.URL)

    def test_admin_recebe_o_conteudo_do_arquivo(self):
        conteudo = {'gerado_em': '2026-11-20T10:00:00-03:00', 'recalculo': [{'N': 1000, 'speedup': 1.5}],
                    'observacoes': ['Processos: compensa a partir de N = 5.000.']}
        with open(self.arquivo, 'w', encoding='utf-8') as f:
            json.dump(conteudo, f, ensure_ascii=False)
        r = self._get(self.admin)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), conteudo)

    def test_sem_arquivo_404_em_portugues(self):
        r = self._get(self.admin)
        self.assertEqual(r.status_code, 404)
        self.assertIn('ainda não foi executado', r.json()['detail'])
        self.assertIn('benchmark_paralelismo', r.json()['detail'])

    def test_arquivo_corrompido_nao_vira_500(self):
        for conteudo in ('{"recalculo": [', '[1, 2]', ''):
            with self.subTest(conteudo=conteudo):
                with open(self.arquivo, 'w', encoding='utf-8') as f:
                    f.write(conteudo)
                r = self._get(self.admin)
                self.assertEqual(r.status_code, 404)
                self.assertIn('não pôde ser lido', r.json()['detail'])

    def test_permissoes(self):
        with open(self.arquivo, 'w', encoding='utf-8') as f:
            f.write('{}')
        self.assertEqual(self._get().status_code, 401)
        r = self._get(self.comum)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json()['detail'], 'Você não tem permissão para executar essa ação.')
