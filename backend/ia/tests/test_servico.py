"""Serviço do modelo: embedder falso, carga única e thread-safe, falhas e texto de origem."""
import os
import tempfile
import threading
import time
from types import SimpleNamespace
from unittest import mock

import numpy as np
from django.test import SimpleTestCase, override_settings

from ia import servico
from ia.servico import EmbedderFalso


class EmbedderFalsoTest(SimpleTestCase):
    def test_deterministico_e_com_384_dimensoes(self):
        a = EmbedderFalso().embed(['Adoro cozinhar para os amigos.'])
        b = EmbedderFalso().embed(['Adoro cozinhar para os amigos.'])
        self.assertEqual(a.shape, (1, 384))
        np.testing.assert_array_equal(a, b)

    def test_palavras_em_comum_aproximam_os_textos(self):
        v = servico._normalizar(EmbedderFalso().embed([
            'Cozinhar receitas caseiras e jantares.',
            'Receitas caseiras: cozinho jantares no fim de semana.',
            'Treino musculação na academia.',
        ]))
        self.assertGreater(v[0] @ v[1], 0.6)
        self.assertLess(abs(v[0] @ v[2]), 0.3)

    def test_texto_sem_palavras_nao_gera_vetor_nulo(self):
        v = EmbedderFalso().embed(['!!! ...'])
        self.assertGreater(np.linalg.norm(v), 0)


class CargaDoModeloTest(SimpleTestCase):
    def setUp(self):
        servico.reiniciar()

    def tearDown(self):
        servico.reiniciar()

    def test_gera_vetores_normalizados(self):
        v = servico.gerar_vetores(['um texto qualquer sobre cozinha', 'outro texto sobre academia'])
        self.assertEqual(v.shape, (2, 384))
        np.testing.assert_allclose(np.linalg.norm(v, axis=1), 1.0, atol=1e-9)
        self.assertEqual(servico.estado()['situacao'], 'disponivel')

    def test_carrega_uma_unica_vez_mesmo_com_varias_threads(self):
        chamadas = []

        def fabrica_lenta(baixar):
            chamadas.append(1)
            time.sleep(0.05)
            return EmbedderFalso()

        resultados = []
        with mock.patch.object(servico, '_criar_embedder', side_effect=fabrica_lenta):
            threads = [threading.Thread(target=lambda: resultados.append(servico.obter_embedder())) for _ in range(8)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
        self.assertEqual(len(chamadas), 1)
        self.assertEqual(len({id(r) for r in resultados}), 1)
        self.assertIsNotNone(resultados[0])

    def test_falha_na_carga_marca_indisponivel_registra_no_log_e_nao_levanta(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('sem internet')) as fabrica, \
                self.assertLogs('ia.servico', level='WARNING') as log:
            self.assertIsNone(servico.gerar_vetores(['texto']))
            self.assertIsNone(servico.obter_embedder())  # dentro do intervalo: não tenta de novo
            self.assertEqual(fabrica.call_count, 1)
            self.assertIsNone(servico.obter_embedder(forcar=True))  # forçado: tenta
            self.assertEqual(fabrica.call_count, 2)
        self.assertIn('indisponível', log.output[0])
        est = servico.estado()
        self.assertEqual(est['situacao'], 'indisponivel')
        self.assertIn('sem internet', est['erro'])
        self.assertFalse(servico.disponivel())

    def test_nova_tentativa_depois_do_intervalo(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('x')):
            servico.obter_embedder()
        servico._estado['tentativa'] -= servico.NOVA_TENTATIVA_S + 1
        self.assertIsNotNone(servico.obter_embedder())
        self.assertTrue(servico.disponivel())

    def test_erro_ao_gerar_embedding_devolve_none(self):
        embedder = servico.obter_embedder()
        with mock.patch.object(embedder, 'embed', side_effect=RuntimeError('onnx')), \
                self.assertLogs('ia.servico', level='ERROR'):
            self.assertIsNone(servico.gerar_vetores(['texto']))

    def test_arquivo_corrompido_vira_indisponivel(self):
        """Simula o fastembed falhando ao abrir o .onnx."""
        with override_settings(IA_EMBEDDER='fastembed'), \
                mock.patch.object(servico, 'EmbedderFastembed', side_effect=RuntimeError('INVALID_PROTOBUF')), \
                self.assertLogs('ia.servico', level='WARNING'):
            self.assertIsNone(servico.obter_embedder())
            self.assertIn('INVALID_PROTOBUF', servico.estado()['erro'])

    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada(self):
        self.assertIsNone(servico.obter_embedder())
        self.assertIsNone(servico.gerar_vetores(['texto']))
        self.assertFalse(servico.disponivel())
        self.assertEqual(servico.estado()['situacao'], 'desabilitada')


class ModeloBaixadoTest(SimpleTestCase):
    def test_procura_o_onnx_na_pasta_configurada(self):
        with tempfile.TemporaryDirectory() as pasta, override_settings(IA_EMBEDDER='fastembed', IA_MODELO_DIR=pasta):
            self.assertFalse(servico.modelo_baixado())
            self.assertFalse(servico.disponivel())  # não carregado e não baixado
            destino = os.path.join(pasta, servico.PASTA_CACHE_MODELO, 'snapshots', 'abc')
            os.makedirs(destino)
            open(os.path.join(destino, 'model_optimized.onnx'), 'wb').close()
            self.assertTrue(servico.modelo_baixado())
            self.assertEqual(servico.nome_modelo(), servico.MODELO)

    def test_embedder_falso_dispensa_download(self):
        self.assertTrue(servico.modelo_baixado())
        self.assertEqual(servico.nome_modelo(), servico.MODELO_FALSO)


class TextoDeOrigemTest(SimpleTestCase):
    def _perfil(self, tipo, bio='', titulo='', descricao=''):
        return SimpleNamespace(bio=bio, titulo_anuncio=titulo, descricao_imovel=descricao,
                               usuario=SimpleNamespace(tipo=tipo))

    def test_quem_oferece_vaga_inclui_titulo_e_descricao_do_anuncio(self):
        p = self._perfil('oferecendo_vaga', 'Gosto de cozinhar.', 'Quarto na praia', 'Apartamento com varanda.')
        self.assertEqual(servico.texto_do_perfil(p), 'Gosto de cozinhar.\nQuarto na praia\nApartamento com varanda.')

    def test_quem_busca_vaga_usa_so_a_bio(self):
        p = self._perfil('buscando_vaga', '  Gosto de cozinhar.  ', 'ignorado', 'ignorado')
        self.assertEqual(servico.texto_do_perfil(p), 'Gosto de cozinhar.')

    def test_minimo_de_20_caracteres_uteis(self):
        self.assertFalse(servico.texto_suficiente('a b c d e f g h i j k l m n o p q r s'))  # 19 letras
        self.assertTrue(servico.texto_suficiente('a b c d e f g h i j k l m n o p q r s t'))  # 20
        self.assertFalse(servico.texto_suficiente('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!     ....'))
        self.assertTrue(servico.texto_suficiente('Açúcar, café e pão às 20h26!'))  # 21: acentos e dígitos contam
        self.assertFalse(servico.texto_suficiente(''))

    def test_hash_muda_com_o_texto(self):
        self.assertEqual(servico.hash_texto('abc'), servico.hash_texto('abc'))
        self.assertNotEqual(servico.hash_texto('abc'), servico.hash_texto('abd'))
        self.assertEqual(len(servico.hash_texto('abc')), 64)
