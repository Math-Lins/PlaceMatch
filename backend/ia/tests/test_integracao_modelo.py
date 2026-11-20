"""
ÚNICO teste com o modelo REAL (paraphrase-multilingual-MiniLM-L12-v2). Pulado se o modelo não estiver
baixado em IA_MODELO_DIR (rode `python manage.py baixar_modelo_ia`). Não acessa a internet.
"""
import unittest

from django.test import SimpleTestCase, override_settings

from ia import servico


@override_settings(IA_EMBEDDER='fastembed')
class ModeloRealTest(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with override_settings(IA_EMBEDDER='fastembed'):
            if not servico.modelo_baixado():
                raise unittest.SkipTest('modelo de IA não baixado (python manage.py baixar_modelo_ia)')

    def setUp(self):
        servico.reiniciar()

    def tearDown(self):
        servico.reiniciar()

    def test_significado_parecido_com_palavras_diferentes(self):
        from matches.algoritmo.afinidade import calibrar
        v = servico.gerar_vetores([
            'Adoro cozinhar para os amigos.',
            'Faço jantares em casa no fim de semana.',
            'Estudo engenharia civil na faculdade.',
            'Adoro festas e receber gente em casa toda semana.',
            'Preciso de silêncio absoluto, odeio barulho e visitas.',
        ])
        self.assertIsNotNone(v, servico.estado()['erro'])
        self.assertEqual(v.shape, (5, 384))
        parecidas, neutras, opostas = float(v[0] @ v[1]), float(v[0] @ v[2]), float(v[3] @ v[4])
        self.assertGreater(parecidas, neutras + 0.2)
        self.assertGreater(calibrar(parecidas), 0.4)
        self.assertEqual(calibrar(neutras), 0.0)
        self.assertLess(calibrar(opostas), 0.1)
        temas = servico.temas_de_vetores(v)
        self.assertIn('culinaria', temas[0])
        self.assertIn('festas', temas[3])
        self.assertIn('silencio', temas[4])
        self.assertEqual(servico.nome_modelo(), servico.MODELO)
