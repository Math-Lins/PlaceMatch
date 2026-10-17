from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status as http_status
from types import SimpleNamespace
from perfis.models import Perfil
from matches.models import Compatibilidade, Curtida, Match
from matches.compatibilidade import (
    calcular_score,
    _sim_horario,
    _sim_visitas,
    _sim_imovel,
)

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
    perfil_horario='flexivel',
    nivel_ruido=3,
    nivel_social=3,
    aceita_visitas='as_vezes',
    tipo_imovel='indiferente',
    qtd_moradores=2,
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
        perfil_horario=perfil_horario,
        nivel_ruido=nivel_ruido,
        nivel_social=nivel_social,
        aceita_visitas=aceita_visitas,
        tipo_imovel=tipo_imovel,
        qtd_moradores=qtd_moradores,
    )
    return user, perfil


def _perfil_ns(**overrides):
    """SimpleNamespace com todos os campos de Perfil usados por calcular_score."""
    defaults = dict(
        orcamento_min=800.0,
        orcamento_max=1500.0,
        regiao='São Paulo',
        fumante=False,
        aceita_pets=True,
        tolerancia_bagunca=3,
        nivel_organizacao=3,
        perfil_horario='flexivel',
        nivel_ruido=3,
        nivel_social=3,
        aceita_visitas='as_vezes',
        tipo_imovel='indiferente',
        qtd_moradores=2,
        idade=25,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


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


# ─── 7. Auxiliar _sim_horario ─────────────────────────────────────────────────

class SimHorarioTest(TestCase):
    def test_iguais_retornam_1(self):
        for v in ('madrugador', 'noturno', 'flexivel'):
            self.assertEqual(_sim_horario(v, v), 1.0, msg=f'_sim_horario({v!r}, {v!r})')

    def test_extremos_opostos_retornam_minimo(self):
        # madrugador vs noturno: único par sem flexível → menor valor da função (0.0)
        self.assertEqual(_sim_horario('madrugador', 'noturno'), 0.0)
        self.assertEqual(_sim_horario('noturno', 'madrugador'), 0.0)

    def test_simetria(self):
        pares = [
            ('madrugador', 'noturno'),
            ('madrugador', 'flexivel'),
            ('noturno', 'flexivel'),
        ]
        for a, b in pares:
            self.assertAlmostEqual(
                _sim_horario(a, b), _sim_horario(b, a), places=4,
                msg=f'_sim_horario({a!r},{b!r}) não é simétrico',
            )


# ─── 8. Auxiliar _sim_visitas ─────────────────────────────────────────────────

class SimVisitasTest(TestCase):
    def test_iguais_retornam_1(self):
        for v in ('raramente', 'as_vezes', 'frequentemente'):
            self.assertEqual(_sim_visitas(v, v), 1.0, msg=f'_sim_visitas({v!r}, {v!r})')

    def test_extremos_opostos_retornam_minimo(self):
        # distância máxima (diff=2): raramente vs frequentemente → 0.0
        self.assertEqual(_sim_visitas('raramente', 'frequentemente'), 0.0)
        self.assertEqual(_sim_visitas('frequentemente', 'raramente'), 0.0)

    def test_simetria(self):
        pares = [
            ('raramente', 'as_vezes'),
            ('raramente', 'frequentemente'),
            ('as_vezes', 'frequentemente'),
        ]
        for a, b in pares:
            self.assertAlmostEqual(
                _sim_visitas(a, b), _sim_visitas(b, a), places=4,
                msg=f'_sim_visitas({a!r},{b!r}) não é simétrico',
            )


# ─── 9. Auxiliar _sim_imovel ──────────────────────────────────────────────────

class SimImovelTest(TestCase):
    def test_iguais_retornam_1(self):
        for v in ('apartamento', 'casa', 'republica', 'indiferente'):
            self.assertEqual(_sim_imovel(v, v), 1.0, msg=f'_sim_imovel({v!r}, {v!r})')

    def test_extremos_opostos_retornam_minimo(self):
        # dois tipos distintos sem 'indiferente' → 0.0 (menor valor da função)
        self.assertEqual(_sim_imovel('apartamento', 'casa'), 0.0)
        self.assertEqual(_sim_imovel('apartamento', 'republica'), 0.0)
        self.assertEqual(_sim_imovel('casa', 'republica'), 0.0)

    def test_simetria(self):
        pares = [
            ('apartamento', 'casa'),
            ('apartamento', 'indiferente'),
            ('casa', 'republica'),
        ]
        for a, b in pares:
            self.assertAlmostEqual(
                _sim_imovel(a, b), _sim_imovel(b, a), places=4,
                msg=f'_sim_imovel({a!r},{b!r}) não é simétrico',
            )


# ─── 10. Direcional por critério (mais parecido = score maior) ────────────────

class ScorePorCriterioTest(TestCase):
    """
    Cada teste varia UM critério mantendo todos os demais idênticos.
    Usa SimpleNamespace para isolar calcular_score do banco de dados.
    """

    def test_orcamento_mais_proximo_tem_score_maior(self):
        base = _perfil_ns()
        b_similar = _perfil_ns(orcamento_min=900.0, orcamento_max=1600.0)   # sobreposição com base
        b_distante = _perfil_ns(orcamento_min=4000.0, orcamento_max=5000.0) # sem sobreposição
        self.assertGreater(calcular_score(base, b_similar), calcular_score(base, b_distante))

    def test_mesma_regiao_tem_score_maior(self):
        base = _perfil_ns(regiao='Vila Madalena')
        b_igual = _perfil_ns(regiao='Vila Madalena')
        b_diferente = _perfil_ns(regiao='Mooca')
        self.assertGreater(calcular_score(base, b_igual), calcular_score(base, b_diferente))

    def test_rotina_mais_compativel_tem_score_maior(self):
        base = _perfil_ns(perfil_horario='madrugador', nivel_ruido=1)
        b_similar = _perfil_ns(perfil_horario='madrugador', nivel_ruido=1)
        b_diferente = _perfil_ns(perfil_horario='noturno', nivel_ruido=5)
        self.assertGreater(calcular_score(base, b_similar), calcular_score(base, b_diferente))

    def test_habitos_mais_compativeis_tem_score_maior(self):
        base = _perfil_ns(
            fumante=True, aceita_pets=False, aceita_visitas='raramente',
            tolerancia_bagunca=1, nivel_organizacao=5, nivel_social=1,
        )
        b_similar = _perfil_ns(
            fumante=True, aceita_pets=False, aceita_visitas='raramente',
            tolerancia_bagunca=1, nivel_organizacao=5, nivel_social=1,
        )
        b_diferente = _perfil_ns(
            fumante=False, aceita_pets=True, aceita_visitas='frequentemente',
            tolerancia_bagunca=5, nivel_organizacao=1, nivel_social=5,
        )
        self.assertGreater(calcular_score(base, b_similar), calcular_score(base, b_diferente))

    def test_estilo_moradia_mais_compativel_tem_score_maior(self):
        base = _perfil_ns(tipo_imovel='apartamento', qtd_moradores=1)
        b_similar = _perfil_ns(tipo_imovel='apartamento', qtd_moradores=1)
        b_diferente = _perfil_ns(tipo_imovel='casa', qtd_moradores=4)
        self.assertGreater(calcular_score(base, b_similar), calcular_score(base, b_diferente))

    def test_faixa_etaria_mais_proxima_tem_score_maior(self):
        base = _perfil_ns(idade=25)
        b_proximo = _perfil_ns(idade=25)  # diff=0 → sim_idade=1.0
        b_distante = _perfil_ns(idade=48) # diff=23 >= 20 → sim_idade=0.0
        self.assertGreater(calcular_score(base, b_proximo), calcular_score(base, b_distante))


# ─── 11. Score sempre em [0.0, 1.0] para combinações extremas ─────────────────

class ScoreLimitesTest(TestCase):
    def _assertLimites(self, a, b):
        s = calcular_score(a, b)
        self.assertGreaterEqual(s, 0.0, msg=f'Score {s} abaixo de 0.0')
        self.assertLessEqual(s, 1.0, msg=f'Score {s} acima de 1.0')

    def test_combinacoes_extremas_sempre_em_zero_a_um(self):
        p_min = _perfil_ns(
            idade=18, orcamento_min=100.0, orcamento_max=100.0,
            fumante=True, aceita_pets=False,
            tolerancia_bagunca=1, nivel_organizacao=1,
            perfil_horario='madrugador', nivel_ruido=1, nivel_social=1,
            aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=1,
            regiao='Zona Norte',
        )
        p_max = _perfil_ns(
            idade=80, orcamento_min=5000.0, orcamento_max=6000.0,
            fumante=False, aceita_pets=True,
            tolerancia_bagunca=5, nivel_organizacao=5,
            perfil_horario='noturno', nivel_ruido=5, nivel_social=5,
            aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=4,
            regiao='Zona Sul',
        )
        p_neutro = _perfil_ns()

        combinacoes = [
            (p_min, p_max),
            (p_max, p_min),
            (p_min, p_neutro),
            (p_max, p_neutro),
            (p_neutro, p_neutro),
        ]
        for a, b in combinacoes:
            self._assertLimites(a, b)


# ─── 12. Simetria com todos os campos novos distintos ─────────────────────────

class ScoreSimetriaComCamposNovosTest(TestCase):
    def test_simetria_com_todos_campos_novos_distintos(self):
        a = _perfil_ns(
            perfil_horario='madrugador', nivel_ruido=1, nivel_social=2,
            aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=1,
        )
        b = _perfil_ns(
            perfil_horario='noturno', nivel_ruido=5, nivel_social=4,
            aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=4,
        )
        self.assertAlmostEqual(calcular_score(a, b), calcular_score(b, a), places=4)


# ─── 13. Perfis idênticos em todos os campos → score 1.0 ─────────────────────

class PerfilIdenticoTest(TestCase):
    def test_perfis_identicos_em_todos_campos_retornam_score_1(self):
        p = _perfil_ns()
        self.assertEqual(calcular_score(p, p), 1.0)


# ─── 14. API: validação dos campos novos do Perfil ────────────────────────────

_PAYLOAD_PERFIL_VALIDO = {
    'nome': 'Teste API',
    'idade': 25,
    'regiao': 'São Paulo',
    'bio': '',
    'orcamento_min': 800,
    'orcamento_max': 1500,
    'fumante': False,
    'aceita_pets': True,
    'tolerancia_bagunca': 3,
    'nivel_organizacao': 3,
}


class CamposNovosAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        _counter[0] += 1
        n = _counter[0]
        self.user = Usuario.objects.create_user(
            username=f'apiuser{n}',
            email=f'apiuser{n}@test.com',
            password='SenhaSegura123!',
            tipo='buscando_vaga',
        )
        self.client.force_authenticate(user=self.user)

    def _post_perfil(self, **overrides):
        payload = {**_PAYLOAD_PERFIL_VALIDO, **overrides}
        return self.client.post('/api/perfis/', payload, format='json')

    def test_perfil_horario_invalido_retorna_400(self):
        res = self._post_perfil(perfil_horario='invalido')
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('perfil_horario', res.data)

    def test_aceita_visitas_invalido_retorna_400(self):
        res = self._post_perfil(aceita_visitas='sempre')
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('aceita_visitas', res.data)

    def test_tipo_imovel_invalido_retorna_400(self):
        res = self._post_perfil(tipo_imovel='kitnet')
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('tipo_imovel', res.data)

    def test_nivel_ruido_fora_de_faixa_retorna_400_com_mensagem(self):
        # MinValueValidator do Django dispara antes do validate_nivel_ruido customizado;
        # a mensagem retornada é a tradução pt-br do DRF: "maior ou igual a 1"
        res = self._post_perfil(nivel_ruido=0)
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('nivel_ruido', res.data)
        self.assertIn('maior ou igual a 1', str(res.data['nivel_ruido']))

    def test_nivel_social_fora_de_faixa_retorna_400_com_mensagem(self):
        # MaxValueValidator do Django dispara antes do validate_nivel_social customizado;
        # a mensagem retornada é a tradução pt-br do DRF: "inferior ou igual a 5"
        res = self._post_perfil(nivel_social=6)
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('nivel_social', res.data)
        self.assertIn('inferior ou igual a 5', str(res.data['nivel_social']))

    def test_qtd_moradores_fora_de_faixa_retorna_400_com_mensagem(self):
        # MaxValueValidator do Django dispara antes do validate_qtd_moradores customizado;
        # a mensagem retornada é a tradução pt-br do DRF: "inferior ou igual a 4"
        res = self._post_perfil(qtd_moradores=5)
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('qtd_moradores', res.data)
        self.assertIn('inferior ou igual a 4', str(res.data['qtd_moradores']))

    def test_criar_perfil_sem_campos_novos_usa_defaults(self):
        res = self._post_perfil()  # nenhum campo novo no payload
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        self.assertEqual(res.data['perfil_horario'], 'flexivel')
        self.assertEqual(res.data['nivel_ruido'], 3)
        self.assertEqual(res.data['nivel_social'], 3)
        self.assertEqual(res.data['aceita_visitas'], 'as_vezes')
        self.assertEqual(res.data['tipo_imovel'], 'indiferente')
        self.assertEqual(res.data['qtd_moradores'], 2)


# ─── 15. API: campos novos presentes em /descoberta/ e /matches/ ──────────────

_CAMPOS_NOVOS = [
    'perfil_horario', 'nivel_ruido', 'nivel_social',
    'aceita_visitas', 'tipo_imovel', 'qtd_moradores',
]


class CamposNovosRespostasTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil(
            tipo='buscando_vaga',
            perfil_horario='madrugador', nivel_ruido=2, nivel_social=4,
            aceita_visitas='frequentemente', tipo_imovel='apartamento', qtd_moradores=2,
        )
        self.user_b, self.pb = _criar_usuario_e_perfil(
            tipo='oferecendo_vaga',
            perfil_horario='noturno', nivel_ruido=4, nivel_social=2,
            aceita_visitas='raramente', tipo_imovel='casa', qtd_moradores=3,
        )

    def test_campos_novos_aparecem_em_descoberta(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get('/api/descoberta/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        self.assertTrue(len(res.data) > 0, 'Descoberta retornou lista vazia')
        perfil = res.data[0]
        for campo in _CAMPOS_NOVOS:
            self.assertIn(campo, perfil, msg=f'Campo {campo!r} ausente em /descoberta/')

    def test_campos_novos_aparecem_em_matches(self):
        # cria match mútuo
        self.client.force_authenticate(user=self.user_a)
        self.client.post('/api/curtidas/', {'perfil_destino': self.pb.id, 'tipo': 'curtir'})
        self.client.force_authenticate(user=self.user_b)
        self.client.post('/api/curtidas/', {'perfil_destino': self.pa.id, 'tipo': 'curtir'})

        self.client.force_authenticate(user=self.user_a)
        res = self.client.get('/api/matches/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        match = res.data[0]
        for campo in _CAMPOS_NOVOS:
            self.assertIn(campo, match['perfil_a'],
                          msg=f'Campo {campo!r} ausente em perfil_a de /matches/')
            self.assertIn(campo, match['perfil_b'],
                          msg=f'Campo {campo!r} ausente em perfil_b de /matches/')
