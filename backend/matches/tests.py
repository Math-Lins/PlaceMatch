from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status as http_status
from perfis.models import Perfil
from matches.models import Compatibilidade, Curtida, Match
from matches.compatibilidade import calcular_score

Usuario = get_user_model()

_counter = [0]


def _criar_usuario_e_perfil(
    tipo,
    nome='Teste',
    idade=25,
    regiao='São Paulo',
    orcamento_min=800,
    orcamento_max=1500,
    fumante=False,
    aceita_pets=True,
    tolerancia_bagunca=3,
    nivel_organizacao=3,
):
    _counter[0] += 1
    n = _counter[0]
    user = Usuario.objects.create_user(
        username=f'user{n}',
        email=f'user{n}@test.com',
        password='SenhaSegura123!',
        tipo=tipo,
    )
    perfil = Perfil.objects.create(
        usuario=user,
        nome=nome,
        idade=idade,
        regiao=regiao,
        orcamento_min=orcamento_min,
        orcamento_max=orcamento_max,
        fumante=fumante,
        aceita_pets=aceita_pets,
        tolerancia_bagunca=tolerancia_bagunca,
        nivel_organizacao=nivel_organizacao,
    )
    return user, perfil


# ─── 1. calcular_score ────────────────────────────────────────────────────────

class CalcularScoreTest(TestCase):
    def setUp(self):
        self.user_a, self.pa = _criar_usuario_e_perfil(
            tipo='buscando_vaga', nome='Alice', idade=25,
            regiao='Vila Madalena', orcamento_min=800, orcamento_max=1400,
            fumante=False, aceita_pets=True, tolerancia_bagunca=3, nivel_organizacao=4,
        )
        self.user_b, self.pb = _criar_usuario_e_perfil(
            tipo='oferecendo_vaga', nome='Bruno', idade=26,
            regiao='Vila Madalena', orcamento_min=900, orcamento_max=1600,
            fumante=False, aceita_pets=True, tolerancia_bagunca=3, nivel_organizacao=4,
        )
        self.user_c, self.pc = _criar_usuario_e_perfil(
            tipo='oferecendo_vaga', nome='Carla', idade=50,
            regiao='Mooca', orcamento_min=3000, orcamento_max=5000,
            fumante=True, aceita_pets=False, tolerancia_bagunca=1, nivel_organizacao=1,
        )

    def test_score_entre_zero_e_um_similares(self):
        score = calcular_score(self.pa, self.pb)
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 1.0)

    def test_score_alto_para_perfis_similares(self):
        score = calcular_score(self.pa, self.pb)
        self.assertGreater(score, 0.70)

    def test_score_baixo_para_perfis_diferentes(self):
        score = calcular_score(self.pa, self.pc)
        self.assertLess(score, 0.40)

    def test_score_simetrico(self):
        self.assertAlmostEqual(
            calcular_score(self.pa, self.pb),
            calcular_score(self.pb, self.pa),
            places=4,
        )


# ─── 2. Compatibilidade só entre tipos opostos ────────────────────────────────

class CompatibilidadeSignalTest(TestCase):
    def test_compatibilidade_criada_entre_tipos_opostos(self):
        _, pa = _criar_usuario_e_perfil(tipo='buscando_vaga')
        _, pb = _criar_usuario_e_perfil(tipo='oferecendo_vaga')
        pa_id, pb_id = min(pa.id, pb.id), max(pa.id, pb.id)
        self.assertTrue(
            Compatibilidade.objects.filter(perfil_a_id=pa_id, perfil_b_id=pb_id).exists()
        )

    def test_compatibilidade_nao_criada_entre_mesmo_tipo(self):
        _, pa = _criar_usuario_e_perfil(tipo='buscando_vaga')
        _, pb = _criar_usuario_e_perfil(tipo='buscando_vaga')
        pa_id, pb_id = min(pa.id, pb.id), max(pa.id, pb.id)
        self.assertFalse(
            Compatibilidade.objects.filter(perfil_a_id=pa_id, perfil_b_id=pb_id).exists()
        )


# ─── 3–5. Curtidas e Match ────────────────────────────────────────────────────

class CurtidaMatchTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil(tipo='buscando_vaga')
        self.user_b, self.pb = _criar_usuario_e_perfil(tipo='oferecendo_vaga')

    def test_curtida_mutua_gera_match(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.post('/api/curtidas/', {'perfil_destino': self.pb.id, 'tipo': 'curtir'})
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        self.assertFalse(res.data['match'])

        self.client.force_authenticate(user=self.user_b)
        res = self.client.post('/api/curtidas/', {'perfil_destino': self.pa.id, 'tipo': 'curtir'})
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        self.assertTrue(res.data['match'])
        self.assertEqual(Match.objects.count(), 1)

    def test_curtir_proprio_perfil_retorna_400(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.post('/api/curtidas/', {'perfil_destino': self.pa.id, 'tipo': 'curtir'})
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('próprio', res.data.get('detail', ''))

    def test_curtir_mesmo_perfil_duas_vezes_retorna_400(self):
        self.client.force_authenticate(user=self.user_a)
        self.client.post('/api/curtidas/', {'perfil_destino': self.pb.id, 'tipo': 'curtir'})
        res = self.client.post('/api/curtidas/', {'perfil_destino': self.pb.id, 'tipo': 'recusar'})
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('já avaliou', res.data.get('detail', ''))


# ─── 6. Descoberta exclui já avaliados ───────────────────────────────────────

class DescobertaTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil(tipo='buscando_vaga')
        self.user_b, self.pb = _criar_usuario_e_perfil(tipo='oferecendo_vaga')
        self.user_c, self.pc = _criar_usuario_e_perfil(tipo='oferecendo_vaga')

    def test_descoberta_nao_retorna_ja_curtidos(self):
        self.client.force_authenticate(user=self.user_a)
        self.client.post('/api/curtidas/', {'perfil_destino': self.pb.id, 'tipo': 'curtir'})

        res = self.client.get('/api/descoberta/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        ids = [p['id'] for p in res.data]
        self.assertNotIn(self.pb.id, ids)
        self.assertIn(self.pc.id, ids)
