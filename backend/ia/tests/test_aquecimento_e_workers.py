"""Aquecimento do modelo na subida do servidor, estado "carregando" e gerar_embeddings --workers."""
import threading
from io import StringIO
from unittest import mock

import numpy as np
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings

from ia import aquecimento, servico
from ia.management.commands import gerar_embeddings as cmd_embeddings
from ia.models import EmbeddingPerfil

from .apoio import BIO_CULINARIA, BIO_CULINARIA_2, BIO_FESTAS, BaseIA, admin, criar

REAL = {'IA_EMBEDDER': 'fastembed', 'IA_HABILITADA': True, 'IA_AQUECIMENTO': True}


class DeteccaoDoServidorTest(SimpleTestCase):
    def test_so_o_servidor_da_api_aquece(self):
        casos = [
            (['manage.py', 'runserver'], {'RUN_MAIN': 'true'}, True),         # filho do autoreload (atende)
            (['manage.py', 'runserver'], {}, False),                          # processo vigia do autoreload
            (['manage.py', 'runserver', '--noreload'], {}, True),
            (['/usr/local/bin/gunicorn', 'placematch.wsgi'], {}, True),
            (['python'], {'SERVER_SOFTWARE': 'gunicorn/23.0.0'}, True),
            (['manage.py', 'test'], {}, False),
            (['manage.py', 'migrate'], {}, False),
            (['manage.py', 'gerar_embeddings'], {}, False),
            (['manage.py', 'shell'], {'RUN_MAIN': 'true'}, False),
            ([], {}, False),
        ]
        for argv, amb, esperado in casos:
            with self.subTest(argv=argv, amb=amb):
                self.assertEqual(aquecimento.eh_servidor(argv, amb), esperado)

    def test_configuracao_desliga(self):
        servidor = (['manage.py', 'runserver', '--noreload'], {})
        with override_settings(**REAL):
            self.assertTrue(aquecimento.deve_aquecer(*servidor))
        for extra in ({'IA_HABILITADA': False}, {'IA_AQUECIMENTO': False}, {'IA_EMBEDDER': 'falso'}):
            with self.subTest(extra=extra), override_settings(**{**REAL, **extra}):
                self.assertFalse(aquecimento.deve_aquecer(*servidor))

    def test_nao_rodou_nos_testes(self):
        # O ready() já rodou ao carregar os apps para os testes: nenhuma thread de aquecimento existe.
        self.assertFalse([t for t in threading.enumerate() if t.name == 'ia-aquecimento'])
        self.assertIsNone(aquecimento.iniciar_se_servidor())
        self.assertIsNone(aquecimento.iniciar_se_servidor(['manage.py', 'test'], {}))

    def test_no_servidor_inicia_thread_daemon_que_nao_bloqueia(self):
        liberar = threading.Event()
        with override_settings(**REAL), mock.patch.object(servico, 'aquecer', side_effect=lambda: liberar.wait(5)) as aq, \
                mock.patch.object(aquecimento, '_thread', None):
            t = aquecimento.iniciar_se_servidor(['manage.py', 'runserver', '--noreload'], {})
            self.assertIsNotNone(t)
            self.assertTrue(t.daemon)
            self.assertEqual(t.name, 'ia-aquecimento')
            self.assertTrue(t.is_alive())  # voltou sem esperar a carga
            self.assertIs(aquecimento.iniciar_se_servidor(['manage.py', 'runserver', '--noreload'], {}), t)  # uma só
            liberar.set()
            t.join(5)
        aq.assert_called_once()


class _EmbedderLento:
    nome = servico.MODELO_FALSO

    def __init__(self, liberar):
        self.liberar = liberar

    def embed(self, textos, workers=1):
        self.liberar.wait(5)
        return servico.EmbedderFalso().embed(textos)


class EstadoCarregandoTest(BaseIA):
    def test_status_mostra_carregando_sem_esperar_a_carga_e_depois_disponivel(self):
        liberar = threading.Event()
        with mock.patch.object(servico, '_criar_embedder', return_value=_EmbedderLento(liberar)):
            t = threading.Thread(target=servico.aquecer)
            t.start()
            for _ in range(200):
                if servico.estado()['situacao'] == 'carregando':
                    break
                threading.Event().wait(0.01)
            est = servico.estado()  # não pode bloquear durante a carga
            self.assertEqual((est['situacao'], est['situacao_texto']), ('carregando', 'ThoLuk carregando'))
            self.assertTrue(servico.disponivel())  # o modelo existe; fica pronto ao terminar
            r = self.como(admin()).get('/api/admin/ia/status/')
            self.assertEqual((r.data['situacao'], r.data['situacao_texto']), ('carregando', 'ThoLuk carregando'))
            self.assertEqual(r.data['nome_ia'], 'ThoLuk')
            liberar.set()
            t.join(5)
        self.assertEqual(servico.estado()['situacao_texto'], 'ThoLuk disponível')
        self.assertIsNotNone(servico.estado()['tempo_carregamento_ms'])

    def test_quem_chega_durante_a_carga_espera_e_reaproveita(self):
        liberar = threading.Event()
        criados = []

        def criar_embedder(baixar):
            criados.append(1)
            return _EmbedderLento(liberar)

        with mock.patch.object(servico, '_criar_embedder', side_effect=criar_embedder):
            resultados = []
            threads = [threading.Thread(target=lambda: resultados.append(servico.obter_embedder())) for _ in range(5)]
            for t in threads:
                t.start()
            liberar.set()
            for t in threads:
                t.join(5)
        self.assertEqual(len(criados), 1)
        self.assertEqual(len({id(r) for r in resultados}), 1)

    def test_falha_no_aquecimento_vira_indisponivel_sem_excecao(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=MemoryError('sem memória')), self.assertLogs('ia.servico'):
            servico.aquecer()
        self.assertEqual(servico.estado()['situacao_texto'], 'ThoLuk indisponível')

    def test_textos_de_todas_as_situacoes(self):
        self.assertEqual(servico.estado()['situacao_texto'], 'ThoLuk não carregado')
        with override_settings(IA_HABILITADA=False):
            self.assertEqual(servico.estado()['situacao_texto'], 'ThoLuk desligado')


class EmbedderWorkersTest(SimpleTestCase):
    def test_workers_vira_parallel_do_fastembed(self):
        emb = object.__new__(servico.EmbedderFastembed)
        emb._modelo = mock.Mock()
        emb._modelo.embed.return_value = iter([np.zeros(384, dtype=np.float32)])
        emb.embed(['texto'], workers=2)
        emb._modelo.embed.assert_called_with(['texto'], batch_size=1, parallel=2)
        emb._modelo.embed.return_value = iter([np.zeros(384, dtype=np.float32)])
        emb.embed(['texto'])
        emb._modelo.embed.assert_called_with(['texto'], batch_size=1, parallel=None)

    def test_memoria_limita_os_workers(self):
        self.assertEqual(cmd_embeddings.workers_possiveis(3, None), 3)
        self.assertEqual(cmd_embeddings.workers_possiveis(3, 1024 + 2 * cmd_embeddings.MB_POR_WORKER + 10), 2)
        self.assertEqual(cmd_embeddings.workers_possiveis(2, 500), 1)
        self.assertEqual(cmd_embeddings.workers_possiveis(1, 100_000), 1)


def _rodar(*args):
    saida, erro = StringIO(), StringIO()
    call_command('gerar_embeddings', *args, stdout=saida, stderr=erro)
    return saida.getvalue(), erro.getvalue()


class GerarEmbeddingsWorkersTest(BaseIA):
    def setUp(self):
        super().setUp()
        for bio in (BIO_CULINARIA, BIO_FESTAS, BIO_CULINARIA_2):
            criar('buscando_vaga', bio)
        criar('oferecendo_vaga', BIO_FESTAS)
        self.ref = {e.perfil_id: bytes(e.vetor) for e in EmbeddingPerfil.objects.all()}
        EmbeddingPerfil.objects.all().delete()

    def test_workers_invalidos(self):
        for w in ('0', '4', '-1'):
            with self.subTest(workers=w), self.assertRaisesMessage(CommandError, 'entre 1 e 3'):
                _rodar('--workers', w, '--sem-recalcular')
        with self.assertRaisesMessage(CommandError, '--lote'):
            _rodar('--lote', '0', '--sem-recalcular')

    def test_com_workers_os_vetores_sao_identicos_e_o_pool_e_usado_uma_vez(self):
        chamadas = []
        original = servico.gerar_vetores

        def espiar(textos, workers=1):
            chamadas.append((len(textos), workers))
            return original(textos, workers=workers)

        with mock.patch.object(cmd_embeddings, 'MIN_TEXTOS_PARALELO', 1), \
                mock.patch.object(cmd_embeddings, 'paralelo_disponivel', return_value=True), \
                mock.patch.object(cmd_embeddings, 'memoria_livre_mb', return_value=100_000.0), \
                mock.patch.object(servico, 'gerar_vetores', side_effect=espiar):
            saida, _ = _rodar('--workers', '2', '--lote', '1', '--sem-recalcular')
        textos_chamada = [c for c in chamadas if c[1] == 2]
        self.assertEqual(textos_chamada, [(4, 2)])  # uma chamada com os 4 textos, não uma por lote
        self.assertIn('4 texto(s) para gerar com 2 workers', saida)
        self.assertIn('ms por perfil gerado, 2 workers', saida)
        self.assertEqual({e.perfil_id: bytes(e.vetor) for e in EmbeddingPerfil.objects.all()}, self.ref)

    def test_poucos_textos_usa_sequencial(self):
        with mock.patch.object(cmd_embeddings, 'paralelo_disponivel', return_value=True):
            saida, _ = _rodar('--workers', '2', '--sem-recalcular')
        self.assertIn('abaixo de', saida)
        self.assertIn('1 worker)', saida)
        self.assertEqual({e.perfil_id: bytes(e.vetor) for e in EmbeddingPerfil.objects.all()}, self.ref)

    def test_pouca_memoria_reduz_workers_com_aviso(self):
        with mock.patch.object(cmd_embeddings, 'MIN_TEXTOS_PARALELO', 1), \
                mock.patch.object(cmd_embeddings, 'paralelo_disponivel', return_value=True), \
                mock.patch.object(cmd_embeddings, 'memoria_livre_mb', return_value=1900.0):
            saida, erro = _rodar('--workers', '3', '--sem-recalcular')
        self.assertIn('comporta só 1 worker', erro)
        self.assertIn('1 worker)', saida)
