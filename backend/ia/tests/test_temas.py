"""Temas de convivência: catálogo e classificação zero-shot (limiar + margem)."""
from unittest import mock

import numpy as np
from django.test import SimpleTestCase

from ia import servico
from ia.explicacao import temas_em_comum
from ia.temas import TEMAS, TEMAS_POR_ID, nomes
from matches.algoritmo.config import LIMIAR_TEMA, MARGEM_TEMA, MAX_TEMAS

ESPERADOS = {'culinaria', 'estudos', 'trabalho_remoto', 'musica', 'festas', 'silencio', 'esportes', 'games', 'leitura',
             'pets', 'natureza', 'arte', 'religiao', 'cinema_series', 'sustentabilidade', 'organizacao'}


class CatalogoTest(SimpleTestCase):
    def test_16_temas_com_2_ou_3_frases_em_portugues(self):
        self.assertEqual({t['id'] for t in TEMAS}, ESPERADOS)
        self.assertEqual(len(TEMAS_POR_ID), len(TEMAS))
        for t in TEMAS:
            self.assertIn(len(t['frases']), (2, 3), t['id'])
            self.assertTrue(t['nome'])
            for f in t['frases']:
                self.assertGreater(len(f), 15)

    def test_nomes_seguem_a_ordem_do_catalogo_e_ignoram_desconhecidos(self):
        self.assertEqual(nomes(['pets', 'xyz', 'culinaria']),
                         [{'id': 'culinaria', 'nome': 'Culinária'}, {'id': 'pets', 'nome': 'Pets'}])
        self.assertEqual(nomes(None), [])

    def test_temas_em_comum_e_a_intersecao(self):
        self.assertEqual(temas_em_comum(['pets', 'musica'], ['musica', 'games']), [{'id': 'musica', 'nome': 'Música'}])
        self.assertEqual(temas_em_comum([], ['musica']), [])


class ClassificacaoTest(SimpleTestCase):
    def setUp(self):
        servico.reiniciar()

    def tearDown(self):
        servico.reiniciar()

    def _notas(self, linha):
        return mock.patch.object(servico, 'pontuar_temas', return_value=np.array([linha]))

    def test_precisa_passar_do_limiar_e_da_margem(self):
        linha = np.full(len(TEMAS), 0.20)
        i_cul, i_pet, i_mus = (list(TEMAS_POR_ID).index(k) for k in ('culinaria', 'pets', 'musica'))
        linha[i_cul] = 0.80                       # passa
        linha[i_pet] = LIMIAR_TEMA - 0.01         # abaixo do limiar
        linha[i_mus] = LIMIAR_TEMA + 0.001        # passa do limiar e da margem (média ~0,27)
        with self._notas(linha):
            self.assertEqual(servico.temas_de_vetores(np.zeros((1, 384))), [['culinaria', 'musica']])

    def test_tema_generico_que_parece_com_tudo_nao_entra(self):
        linha = np.full(len(TEMAS), 0.55)  # tudo acima do limiar, nada acima da média + margem
        with self._notas(linha):
            self.assertEqual(servico.temas_de_vetores(np.zeros((1, 384))), [[]])
        self.assertGreater(MARGEM_TEMA, 0)

    def test_no_maximo_max_temas_em_ordem_de_nota(self):
        linha = np.zeros(len(TEMAS))
        linha[:8] = np.linspace(0.9, 0.6, 8)
        with self._notas(linha):
            ids = servico.temas_de_vetores(np.zeros((1, 384)))[0]
        self.assertEqual(ids, [t['id'] for t in TEMAS[:MAX_TEMAS]])

    def test_com_o_embedder_falso_detecta_o_tema_pelas_palavras(self):
        v = servico.gerar_vetores(['Adoro cozinhar e testar receitas novas; preparo jantares e comidas caseiras para os amigos.'])
        self.assertIn('culinaria', servico.temas_de_vetores(v)[0])

    def test_frases_dos_temas_sao_calculadas_uma_vez(self):
        with mock.patch.object(servico, 'gerar_vetores', wraps=servico.gerar_vetores) as gerar:
            servico.pontuar_temas(np.ones((1, 384)) / np.sqrt(384))
            servico.pontuar_temas(np.ones((1, 384)) / np.sqrt(384))
        self.assertEqual(gerar.call_count, 1)

    def test_sem_modelo_nao_classifica(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('x')), self.assertLogs('ia.servico'):
            self.assertIsNone(servico.temas_de_vetores(np.zeros((1, 384))))
