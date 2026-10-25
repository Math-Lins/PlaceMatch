import itertools
import random
import sys

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
from matches.algoritmo import calcular_scores_lote
from matches.servicos import recalcular_lote

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

    def test_descoberta_nao_retorna_ja_matched(self):
        # Cria match direto entre pa e pb (sem passar pelas curtidas)
        Match.objects.create(perfil_a=self.pa, perfil_b=self.pb, score=0.8)

        self.client.force_authenticate(user=self.user_a)
        res = self.client.get('/api/descoberta/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        ids = [p['id'] for p in res.data]
        self.assertNotIn(self.pb.id, ids, 'pb já é match e não deve aparecer na descoberta')
        self.assertIn(self.pc.id, ids, 'pc ainda não é match e deve aparecer na descoberta')


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


# =============================================================================
# Testes da camada vetorial / servicos (Parte 2)
# =============================================================================

class EquivalenciaVetorialEscalarReforcoTest(TestCase):
    """
    ~318 perfis em memória (SimpleNamespace); cobre todas as 36 combinações
    categóricas (perfil_horario × aceita_visitas × tipo_imovel), extremos e
    intermediários de todos os campos numéricos, seis casos de sobreposição de
    orçamento e oito variações de caixa/espaço na região.

    Compara TODOS os pares nos dois sentidos (grupo_a como base → grupo_b,
    e grupo_b como base → grupo_a). Falha se |diff| > 1e-4.
    Imprime sempre: total de pares comparados e maior diferença absoluta.
    """

    @staticmethod
    def _make(pid, **kw):
        defaults = dict(
            id=pid, orcamento_min=800.0, orcamento_max=1500.0,
            regiao='Boa Viagem', fumante=False, aceita_pets=True,
            tolerancia_bagunca=3, nivel_organizacao=3, perfil_horario='flexivel',
            nivel_ruido=3, nivel_social=3, aceita_visitas='as_vezes',
            tipo_imovel='indiferente', qtd_moradores=2, idade=25,
        )
        defaults.update(kw)
        return SimpleNamespace(**defaults)

    def _montar_conjunto(self):
        """Monta lista de ≈318 perfis cobrindo todos os casos críticos."""
        random.seed(42)

        HORARIOS = ['madrugador', 'noturno', 'flexivel']
        VISITAS  = ['raramente', 'as_vezes', 'frequentemente']
        IMOVEIS  = ['apartamento', 'casa', 'republica', 'indiferente']
        REGIOES  = [
            'Boa Viagem', ' boa viagem ', 'BOA VIAGEM', 'boa viagem',
            'Recife', 'RECIFE', ' recife ', 'Olinda',
        ]
        ORCAMENTOS = [
            (800.0,  1500.0),  # sobreposição total com referência (800,1500)
            (1000.0, 1800.0),  # sobreposição parcial superior
            (2000.0, 3000.0),  # sem sobreposição
            (500.0,   900.0),  # sobreposição parcial inferior
            (1500.0, 2500.0),  # toca exatamente no limite superior
            (0.0,  10000.0),   # contém completamente a referência
        ]
        # 6 configurações numéricas: mínimo, dois intermediários, máximo, misto
        NUM = [
            dict(nivel_ruido=1, nivel_social=1, qtd_moradores=1,
                 tolerancia_bagunca=1, nivel_organizacao=1, idade=18),
            dict(nivel_ruido=2, nivel_social=2, qtd_moradores=2,
                 tolerancia_bagunca=2, nivel_organizacao=2, idade=25),
            dict(nivel_ruido=3, nivel_social=3, qtd_moradores=2,
                 tolerancia_bagunca=3, nivel_organizacao=3, idade=35),
            dict(nivel_ruido=4, nivel_social=4, qtd_moradores=3,
                 tolerancia_bagunca=4, nivel_organizacao=4, idade=50),
            dict(nivel_ruido=5, nivel_social=5, qtd_moradores=4,
                 tolerancia_bagunca=5, nivel_organizacao=5, idade=80),
            dict(nivel_ruido=1, nivel_social=5, qtd_moradores=4,
                 tolerancia_bagunca=5, nivel_organizacao=1, idade=45),
        ]

        perfis = []
        pid = 1

        # Bloco 1 — todas as 36 combinações categóricas × 5 configurações (180 perfis)
        for idx, (h, v, im) in enumerate(itertools.product(HORARIOS, VISITAS, IMOVEIS)):
            for j, nc in enumerate(NUM[:5]):
                o = ORCAMENTOS[(idx + j) % len(ORCAMENTOS)]
                perfis.append(self._make(
                    pid,
                    perfil_horario=h, aceita_visitas=v, tipo_imovel=im,
                    regiao=REGIOES[(idx + j) % len(REGIOES)],
                    orcamento_min=o[0], orcamento_max=o[1],
                    fumante=bool((idx + j) % 2),
                    aceita_pets=bool((idx + j + 1) % 2),
                    **nc,
                ))
                pid += 1

        # Bloco 2 — pares de extremos em todos os campos numéricos (16 perfis)
        for ruido in [1, 5]:
            for social in [1, 5]:
                for qtd in [1, 4]:
                    for idade in [18, 80]:
                        perfis.append(self._make(
                            pid,
                            nivel_ruido=ruido, nivel_social=social,
                            qtd_moradores=qtd,
                            tolerancia_bagunca=ruido,
                            nivel_organizacao=6 - social,
                            idade=idade,
                        ))
                        pid += 1

        # Bloco 3 — todos os casos de orçamento × variações categóricas (54 perfis)
        for idx, (o_min, o_max) in enumerate(ORCAMENTOS):
            for h in HORARIOS:
                for v in VISITAS:
                    perfis.append(self._make(
                        pid,
                        orcamento_min=o_min, orcamento_max=o_max,
                        perfil_horario=h, aceita_visitas=v,
                        regiao=REGIOES[idx % len(REGIOES)],
                    ))
                    pid += 1

        # Bloco 4 — cada variação de região isolada (8 perfis)
        for r in REGIOES:
            perfis.append(self._make(pid, regiao=r))
            pid += 1

        # Bloco 5 — gradiente de idade × gradiente de organização (60 perfis)
        for idade in [18, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80]:
            for org in [1, 2, 3, 4, 5]:
                perfis.append(self._make(
                    pid,
                    idade=idade,
                    nivel_organizacao=org,
                    tolerancia_bagunca=6 - org,
                ))
                pid += 1

        return perfis  # total ≈ 318

    def test_scores_lote_equivalentes_ao_escalar(self):
        todos = self._montar_conjunto()
        metade = len(todos) // 2
        grupo_a = todos[:metade]
        grupo_b = todos[metade:]

        total_pares = 0
        max_diff = 0.0

        # Dois sentidos: grupo_a como base e grupo_b como base
        for base_grupo, outro_grupo in [(grupo_a, grupo_b), (grupo_b, grupo_a)]:
            for base in base_grupo:
                _, scores_lote = calcular_scores_lote(base, outro_grupo)
                for outro, score_lote in zip(outro_grupo, scores_lote.tolist()):
                    score_esc = calcular_score(base, outro)
                    diff = abs(score_lote - score_esc)
                    if diff > max_diff:
                        max_diff = diff
                    total_pares += 1
                    self.assertLessEqual(
                        diff, 1e-4,
                        msg=(
                            f'base.id={base.id} outro.id={outro.id}: '
                            f'lote={score_lote:.6f} escalar={score_esc:.6f} '
                            f'diff={diff:.2e}'
                        ),
                    )

        print(
            f'\n[EquivalenciaReforco] pares comparados: {total_pares:,} | '
            f'maior diferença absoluta: {max_diff:.2e}',
            file=sys.stderr,
        )


class RecalcularLoteOrdemSignalTest(TestCase):
    """recalcular_lote deve salvar Compatibilidade com pa_id < pb_id."""

    def test_compatibilidade_salva_com_pa_menor_que_pb(self):
        u_b, pb = _criar_usuario_e_perfil('buscando_vaga', nome='Buscador')
        u_o, po = _criar_usuario_e_perfil('oferecendo_vaga', nome='Ofertante')

        # Limpa compatibilidades geradas pelo signal no setUp
        Compatibilidade.objects.all().delete()

        recalcular_lote(pb)

        compat = Compatibilidade.objects.get(
            perfil_a_id=min(pb.id, po.id),
            perfil_b_id=max(pb.id, po.id),
        )
        self.assertLessEqual(compat.perfil_a_id, compat.perfil_b_id)
        self.assertGreaterEqual(compat.score, 0.0)
        self.assertLessEqual(compat.score, 1.0)


class UpsertSemDuplicataTest(TestCase):
    """Chamar recalcular_lote duas vezes não deve criar registros duplicados."""

    def test_dois_recalculos_nao_criam_duplicatas(self):
        u_b, pb = _criar_usuario_e_perfil('buscando_vaga', nome='Buscador2')
        _, _po = _criar_usuario_e_perfil('oferecendo_vaga', nome='Ofertante2')

        Compatibilidade.objects.all().delete()

        recalcular_lote(pb)
        recalcular_lote(pb)

        count = Compatibilidade.objects.filter(
            **{f'perfil_{"a" if pb.id < _po.id else "b"}_id': pb.id}
        ).count()
        self.assertEqual(count, 1, 'Deveria existir exatamente 1 registro de compatibilidade')


class RecalcularComandoTest(TestCase):
    """management command recalcular_compatibilidades executa sem erros."""

    def test_comando_executa_sem_excecao(self):
        from django.core.management import call_command
        from io import StringIO
        _criar_usuario_e_perfil('buscando_vaga',  nome='CmdB')
        _criar_usuario_e_perfil('oferecendo_vaga', nome='CmdO')
        out = StringIO()
        # deve concluir sem lançar exceção
        call_command('recalcular_compatibilidades', stdout=out)
        self.assertIn('Concluído', out.getvalue())


# =============================================================================
# Testes de filtros da Descoberta (Parte 3)
# =============================================================================

class DescobertaFiltrosTest(TestCase):
    """
    Testa os parâmetros de filtro, ordenação e validação da DescobertaView.
    user_a (buscando_vaga) vê perfis oferecendo_vaga e vice-versa.
    """

    def setUp(self):
        self.client = APIClient()
        # Buscador (visualiza oferecendo_vaga)
        self.user_a, self.pa = _criar_usuario_e_perfil(
            'buscando_vaga', nome='Buscador Alpha',
            regiao='Recife', orcamento_min=500, orcamento_max=1500,
            fumante=False, aceita_pets=True, tipo_imovel='apartamento',
        )
        # Ofertante 1 — boa compatibilidade com pa
        self.user_b, self.pb = _criar_usuario_e_perfil(
            'oferecendo_vaga', nome='Ofertante Beta',
            regiao='Recife', orcamento_min=600, orcamento_max=1400,
            fumante=False, aceita_pets=True, tipo_imovel='apartamento',
        )
        self.pb.titulo_anuncio = 'Quarto ensolarado Boa Viagem'
        self.pb.save(update_fields=['titulo_anuncio'])
        # Ofertante 2 — atributos distintos
        self.user_c, self.pc = _criar_usuario_e_perfil(
            'oferecendo_vaga', nome='Ofertante Gamma',
            regiao='Olinda', orcamento_min=2000, orcamento_max=3000,
            fumante=True, aceita_pets=False, tipo_imovel='casa',
        )
        self.pc.titulo_anuncio = 'Casa espaçosa Olinda'
        self.pc.save(update_fields=['titulo_anuncio'])
        self.client.force_authenticate(user=self.user_a)

    # ── Filtro q ──────────────────────────────────────────────────────────────

    def test_filtro_q_por_nome(self):
        res = self.client.get('/api/descoberta/?q=Beta')
        self.assertEqual(res.status_code, 200)
        ids = [p['id'] for p in res.data]
        self.assertIn(self.pb.id, ids)
        self.assertNotIn(self.pc.id, ids)

    def test_filtro_q_por_titulo_anuncio(self):
        res = self.client.get('/api/descoberta/?q=ensolarado')
        self.assertEqual(res.status_code, 200)
        ids = [p['id'] for p in res.data]
        self.assertIn(self.pb.id, ids)
        self.assertNotIn(self.pc.id, ids)

    def test_filtro_q_sem_resultado(self):
        res = self.client.get('/api/descoberta/?q=xyzinexistente')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, [])

    # ── Filtro regiao ────────────────────────────────────────────────────────

    def test_filtro_regiao_unica(self):
        res = self.client.get('/api/descoberta/?regiao=Olinda')
        ids = [p['id'] for p in res.data]
        self.assertIn(self.pc.id, ids)
        self.assertNotIn(self.pb.id, ids)

    def test_filtro_regiao_multipla(self):
        res = self.client.get('/api/descoberta/?regiao=Recife&regiao=Olinda')
        ids = [p['id'] for p in res.data]
        self.assertIn(self.pb.id, ids)
        self.assertIn(self.pc.id, ids)

    # ── Filtro tipo_imovel ───────────────────────────────────────────────────

    def test_filtro_tipo_imovel(self):
        res = self.client.get('/api/descoberta/?tipo_imovel=apartamento')
        ids = [p['id'] for p in res.data]
        self.assertIn(self.pb.id, ids)
        self.assertNotIn(self.pc.id, ids)

    # ── Filtro aceita_pets e fumante ─────────────────────────────────────────

    def test_filtro_aceita_pets_true(self):
        res = self.client.get('/api/descoberta/?aceita_pets=true')
        ids = [p['id'] for p in res.data]
        self.assertIn(self.pb.id, ids)
        self.assertNotIn(self.pc.id, ids)

    def test_filtro_aceita_pets_false(self):
        res = self.client.get('/api/descoberta/?aceita_pets=false')
        ids = [p['id'] for p in res.data]
        self.assertNotIn(self.pb.id, ids)
        self.assertIn(self.pc.id, ids)

    def test_filtro_fumante_true(self):
        res = self.client.get('/api/descoberta/?fumante=true')
        ids = [p['id'] for p in res.data]
        self.assertIn(self.pc.id, ids)
        self.assertNotIn(self.pb.id, ids)

    # ── Filtro orçamento (interseção) ────────────────────────────────────────

    def test_filtro_orcamento_intersecao_encontra_pb(self):
        # pb: [600, 1400]; filtro [800, 1200] → intersecta
        res = self.client.get('/api/descoberta/?orcamento_min=800&orcamento_max=1200')
        ids = [p['id'] for p in res.data]
        self.assertIn(self.pb.id, ids)
        self.assertNotIn(self.pc.id, ids)

    def test_filtro_orcamento_sem_intersecao(self):
        # pc: [2000, 3000]; filtro [100, 500] → sem interseção
        res = self.client.get('/api/descoberta/?orcamento_max=500')
        ids = [p['id'] for p in res.data]
        self.assertNotIn(self.pc.id, ids)

    # ── Filtro score_min ─────────────────────────────────────────────────────

    def test_filtro_score_min_exclui_baixo_score(self):
        # Força scores: pb → 0.9, pc → 0.1
        pa_id, pb_id = min(self.pa.id, self.pb.id), max(self.pa.id, self.pb.id)
        Compatibilidade.objects.update_or_create(
            perfil_a_id=pa_id, perfil_b_id=pb_id,
            defaults={'score': 0.9},
        )
        pa_id2, pb_id2 = min(self.pa.id, self.pc.id), max(self.pa.id, self.pc.id)
        Compatibilidade.objects.update_or_create(
            perfil_a_id=pa_id2, perfil_b_id=pb_id2,
            defaults={'score': 0.1},
        )
        # score_min=50 → 50% → 0.5; pc (0.1) deve sair
        res = self.client.get('/api/descoberta/?score_min=50')
        self.assertEqual(res.status_code, 200)
        ids = [p['id'] for p in res.data]
        self.assertIn(self.pb.id, ids)
        self.assertNotIn(self.pc.id, ids)

    # ── Ordenação ────────────────────────────────────────────────────────────

    def test_ordenar_orcamento_asc(self):
        res = self.client.get('/api/descoberta/?ordenar=orcamento_asc')
        self.assertEqual(res.status_code, 200)
        # pb.orcamento_min=600 < pc.orcamento_min=2000 → pb primeiro
        ids = [p['id'] for p in res.data]
        self.assertLess(ids.index(self.pb.id), ids.index(self.pc.id))

    def test_ordenar_orcamento_desc(self):
        res = self.client.get('/api/descoberta/?ordenar=orcamento_desc')
        self.assertEqual(res.status_code, 200)
        ids = [p['id'] for p in res.data]
        self.assertLess(ids.index(self.pc.id), ids.index(self.pb.id))

    def test_ordenar_score_default(self):
        # score padrão (score desc) — só verifica que não gera erro e retorna resultados
        res = self.client.get('/api/descoberta/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data), 2)

    # ── Validação de parâmetros inválidos ────────────────────────────────────

    def test_400_aceita_pets_invalido(self):
        res = self.client.get('/api/descoberta/?aceita_pets=sim')
        self.assertEqual(res.status_code, 400)
        self.assertIn('aceita_pets', res.data.get('detail', ''))

    def test_400_fumante_invalido(self):
        res = self.client.get('/api/descoberta/?fumante=nao')
        self.assertEqual(res.status_code, 400)
        self.assertIn('fumante', res.data.get('detail', ''))

    def test_400_orcamento_min_invalido(self):
        res = self.client.get('/api/descoberta/?orcamento_min=abc')
        self.assertEqual(res.status_code, 400)
        self.assertIn('orcamento_min', res.data.get('detail', ''))

    def test_400_orcamento_max_invalido(self):
        res = self.client.get('/api/descoberta/?orcamento_max=xyz')
        self.assertEqual(res.status_code, 400)
        self.assertIn('orcamento_max', res.data.get('detail', ''))

    def test_400_score_min_fora_de_faixa(self):
        res = self.client.get('/api/descoberta/?score_min=150')
        self.assertEqual(res.status_code, 400)
        self.assertIn('score_min', res.data.get('detail', ''))

    def test_400_ordenar_invalido(self):
        res = self.client.get('/api/descoberta/?ordenar=invalido')
        self.assertEqual(res.status_code, 400)
        self.assertIn('ordenar', res.data.get('detail', ''))

    # ── Regressão: match existente não aparece na descoberta ─────────────────

    def test_regressao_match_existente_exclui_perfil(self):
        Match.objects.create(perfil_a=self.pa, perfil_b=self.pb, score=0.8)
        res = self.client.get('/api/descoberta/')
        self.assertEqual(res.status_code, 200)
        ids = [p['id'] for p in res.data]
        self.assertNotIn(self.pb.id, ids, 'pb tem match e não deve aparecer na descoberta')
        self.assertIn(self.pc.id, ids, 'pc sem match deve continuar visível')
