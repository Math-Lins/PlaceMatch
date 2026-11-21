"""
Temas de convivência com o modelo REAL: os 3 exemplos do laboratório do painel e bios do seed de demonstração.
Fixa os temas esperados, inclusive os que não devem aparecer (falsos positivos).
Pulado se o modelo não estiver baixado em IA_MODELO_DIR (rode `python manage.py baixar_modelo_ia`).
"""
import unittest

from django.test import SimpleTestCase, override_settings

from ia import servico
from perfis.management.commands.seed_perfis import SEED_USERS

API = {  # bios dos exemplos do Swagger (scripts/gerar_exemplos_api.py)
    'ana1': 'Estudante de Computação, rotina tranquila.',
    'ana2': 'Estudante de Computação, rotina tranquila e gosta de cozinhar.',
}

LAB = {
    '1A': 'Adoro cozinhar para os amigos e testar receitas novas.',
    '1B': 'Faço jantares em casa no fim de semana e curto gastronomia.',
    '2A': 'Amo festas, receber gente em casa e sair toda sexta.',
    '2B': 'Gosto de silêncio, leio muito e durmo cedo.',
    '3A': 'Estou no último ano de engenharia e passo as noites estudando.',
    '3B': 'Faço mestrado e preciso de um ambiente tranquilo para estudar.',
}

# Temas esperados para bios do seed (texto = bio + anúncio para quem oferece vaga, como no sistema).
# Ficam de fora os temas no limite da margem, que podem oscilar com qualquer mudança no modelo.
SEED_ESPERADO = {
    'Ana': {'arte', 'pets'},
    'Pedro': {'musica'},
    'Rafael': {'silencio'},
    'Elizabete': {'arte'},
    'João': {'leitura', 'silencio', 'estudos'},
    'Mariana': {'estudos'},
    'Fernanda': {'silencio', 'leitura'},
    'Isabela': {'culinaria'},
    'Guilherme': {'festas'},
    'Patrícia': {'silencio', 'organizacao'},
    'Diego': {'cinema_series'},
    'Beatriz': {'pets'},
    'Renato': {'trabalho_remoto'},
    'Henrique': {'culinaria'},
    'Júlia': {'natureza', 'pets'},
    'Marcos': {'festas'},
}


def _texto_seed(tipo, d):
    partes = [d.get('bio', '')]
    if tipo == 'oferecendo_vaga':
        partes += [d.get('titulo_anuncio', ''), d.get('descricao_imovel', '')]
    return '\n'.join(p.strip() for p in partes if p and p.strip())


@override_settings(IA_EMBEDDER='fastembed')
class TemasModeloRealTest(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with override_settings(IA_EMBEDDER='fastembed'):
            if not servico.modelo_baixado():
                raise unittest.SkipTest('modelo de IA não baixado (python manage.py baixar_modelo_ia)')
            servico.reiniciar()
            seed = {d['nome'].split()[0]: _texto_seed(tipo, d) for _, _, tipo, d in SEED_USERS}
            cls.rotulos = list(LAB) + list(API) + list(SEED_ESPERADO)
            textos = list(LAB.values()) + list(API.values()) + [seed[n] for n in SEED_ESPERADO]
            vetores = servico.gerar_vetores(textos)
            assert vetores is not None, servico.estado()['erro']
            cls.temas = {r: set(t) for r, t in zip(cls.rotulos, servico.temas_de_vetores(vetores))}

    @classmethod
    def tearDownClass(cls):
        servico.reiniciar()
        super().tearDownClass()

    def test_exemplo_1_culinaria_nos_dois_sem_trabalho_remoto(self):
        self.assertIn('culinaria', self.temas['1A'])
        self.assertIn('culinaria', self.temas['1B'])
        self.assertIn('culinaria', self.temas['1A'] & self.temas['1B'])
        self.assertNotIn('trabalho_remoto', self.temas['1B'])
        self.assertNotIn('organizacao', self.temas['1B'])

    def test_exemplo_2_festas_x_silencio_e_leitura_sem_nada_em_comum(self):
        self.assertIn('festas', self.temas['2A'])
        self.assertNotIn('organizacao', self.temas['2A'])
        self.assertNotIn('culinaria', self.temas['2A'])
        self.assertTrue({'silencio', 'leitura'} <= self.temas['2B'], self.temas['2B'])
        self.assertEqual(self.temas['2A'] & self.temas['2B'], set())

    def test_exemplo_3_estudos_em_comum(self):
        self.assertIn('estudos', self.temas['3A'] & self.temas['3B'])
        self.assertNotIn('games', self.temas['3A'])

    def test_computacao_nao_vira_trabalho_remoto_nem_games(self):
        self.assertEqual(self.temas['ana1'] & {'trabalho_remoto', 'games'}, set())
        self.assertEqual(self.temas['ana2'], {'culinaria'})

    def test_bios_do_seed(self):
        for nome, esperado in SEED_ESPERADO.items():
            with self.subTest(nome=nome):
                self.assertTrue(esperado <= self.temas[nome], f'{nome}: esperado {esperado}, obtido {self.temas[nome]}')

    def test_falsos_positivos_corrigidos_no_seed(self):
        self.assertNotIn('sustentabilidade', self.temas['Elizabete'])   # artista plástica
        self.assertNotIn('sustentabilidade', self.temas['Henrique'])    # gastronomia
        self.assertNotIn('trabalho_remoto', self.temas['Patrícia'])     # analista que trabalha fora
        self.assertNotIn('festas', self.temas['João'])                  # professor que gosta de silêncio
