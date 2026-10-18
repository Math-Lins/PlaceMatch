"""
Teste de integração E2E do módulo Chat.

Cobre o fluxo completo via API REST:
  registrar → login → criar perfil → descoberta → curtidas mútuas → match
  → /api/conversas/ → troca de mensagens → não lidas / lidas
  → terceiro usuário bloqueado (403/404)
"""

from rest_framework import status as http_status
from rest_framework.test import APITestCase, APIClient


# ─── helpers ─────────────────────────────────────────────────────────────────

PERFIL_BASE = dict(
    nome='Usuário Teste', idade=25, regiao='Recife',
    bio='Teste de integração.',
    orcamento_min=800, orcamento_max=1500,
    fumante=False, aceita_pets=False,
    tolerancia_bagunca=3, nivel_organizacao=3,
    perfil_horario='flexivel', nivel_ruido=3, nivel_social=3,
    aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
)

_seq = [0]


def _email():
    _seq[0] += 1
    return f'integ_user{_seq[0]}@test.com'


def _registrar_e_logar(client: APIClient, tipo: str, extra_nome: str = '') -> dict:
    email = _email()
    username = email.split('@')[0]
    # Registrar
    res = client.post('/api/auth/registrar/', {
        'username': username,
        'email': email,
        'password': 'Senha@1234',
        'tipo': tipo,
    }, format='json')
    assert res.status_code == 201, f'registrar falhou: {res.data}'

    # Login
    res = client.post('/api/auth/login/', {
        'email': email,
        'password': 'Senha@1234',
    }, format='json')
    assert res.status_code == 200, f'login falhou: {res.data}'
    token = res.data['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return {'email': email, 'token': token, 'nome': extra_nome or username}


def _criar_perfil(client: APIClient, nome: str = 'Teste') -> dict:
    payload = {**PERFIL_BASE, 'nome': nome}
    res = client.post('/api/perfis/', payload, format='json')
    assert res.status_code == 201, f'criar_perfil falhou: {res.data}'
    return res.data


# ─── Fluxo completo ───────────────────────────────────────────────────────────

class FluxoCompletoTest(APITestCase):
    """
    Dois usuários de tipos opostos percorrem todo o fluxo via API:
    registro → perfil → descoberta → curtidas mútuas → match → chat.
    """

    def setUp(self):
        self.client_a = APIClient()
        self.client_b = APIClient()

        # Usuário A: buscando_vaga
        _registrar_e_logar(self.client_a, 'buscando_vaga', 'Alice')
        self.perfil_a = _criar_perfil(self.client_a, 'Alice')

        # Usuário B: oferecendo_vaga
        _registrar_e_logar(self.client_b, 'oferecendo_vaga', 'Bruno')
        self.perfil_b = _criar_perfil(self.client_b, 'Bruno')

    # 1. Descoberta

    def test_a_ve_b_na_descoberta(self):
        res = self.client_a.get('/api/descoberta/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        ids = [p['id'] for p in res.data]
        self.assertIn(self.perfil_b['id'], ids)

    def test_descoberta_inclui_score(self):
        res = self.client_a.get('/api/descoberta/')
        perfil = next(p for p in res.data if p['id'] == self.perfil_b['id'])
        self.assertIn('score', perfil)
        self.assertGreaterEqual(perfil['score'], 0.0)
        self.assertLessEqual(perfil['score'], 1.0)

    def test_b_ve_a_na_descoberta(self):
        res = self.client_b.get('/api/descoberta/')
        ids = [p['id'] for p in res.data]
        self.assertIn(self.perfil_a['id'], ids)

    # 2. Curtidas mútuas geram match

    def test_curtidas_mutuas_geram_match(self):
        # A curte B
        res = self.client_a.post('/api/curtidas/', {
            'perfil_destino': self.perfil_b['id'],
            'tipo': 'curtir',
        }, format='json')
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        self.assertFalse(res.data['match'])  # ainda não é match

        # B curte A → match!
        res = self.client_b.post('/api/curtidas/', {
            'perfil_destino': self.perfil_a['id'],
            'tipo': 'curtir',
        }, format='json')
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        self.assertTrue(res.data['match'])
        self.assertIn('match_data', res.data)
        self.match_id = res.data['match_data']['id']
        return self.match_id

    # 3. Match aparece em /api/conversas/ para os dois

    def _gerar_match(self):
        self.client_a.post('/api/curtidas/', {'perfil_destino': self.perfil_b['id'], 'tipo': 'curtir'}, format='json')
        res = self.client_b.post('/api/curtidas/', {'perfil_destino': self.perfil_a['id'], 'tipo': 'curtir'}, format='json')
        return res.data['match_data']['id']

    def test_match_aparece_em_conversas_para_a(self):
        match_id = self._gerar_match()
        res = self.client_a.get('/api/conversas/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        ids = [c['match_id'] for c in res.data]
        self.assertIn(match_id, ids)

    def test_match_aparece_em_conversas_para_b(self):
        match_id = self._gerar_match()
        res = self.client_b.get('/api/conversas/')
        ids = [c['match_id'] for c in res.data]
        self.assertIn(match_id, ids)

    # 4. Troca de mensagens

    def test_troca_de_mensagens_nos_dois_sentidos(self):
        match_id = self._gerar_match()

        res_a = self.client_a.post(f'/api/matches/{match_id}/mensagens/', {'conteudo': 'Oi Bruno!'}, format='json')
        self.assertEqual(res_a.status_code, http_status.HTTP_201_CREATED)
        self.assertEqual(res_a.data['remetente_id'], self.perfil_a['id'])

        res_b = self.client_b.post(f'/api/matches/{match_id}/mensagens/', {'conteudo': 'Olá Alice!'}, format='json')
        self.assertEqual(res_b.status_code, http_status.HTTP_201_CREATED)
        self.assertEqual(res_b.data['remetente_id'], self.perfil_b['id'])

        # A lista as mensagens e vê ambas em ordem
        res = self.client_a.get(f'/api/matches/{match_id}/mensagens/')
        self.assertEqual(len(res.data), 2)
        self.assertEqual(res.data[0]['conteudo'], 'Oi Bruno!')
        self.assertEqual(res.data[1]['conteudo'], 'Olá Alice!')

    # 5. Não lidas e leitura

    def test_nao_lidas_antes_e_depois_de_listar(self):
        match_id = self._gerar_match()

        # A envia 2 mensagens
        self.client_a.post(f'/api/matches/{match_id}/mensagens/', {'conteudo': 'Msg1'}, format='json')
        self.client_a.post(f'/api/matches/{match_id}/mensagens/', {'conteudo': 'Msg2'}, format='json')

        # B verifica conversas: deve ter 2 não lidas
        res = self.client_b.get('/api/conversas/')
        conversa = next(c for c in res.data if c['match_id'] == match_id)
        self.assertEqual(conversa['nao_lidas'], 2)

        # B lista mensagens → marca como lidas
        self.client_b.get(f'/api/matches/{match_id}/mensagens/')

        # B verifica conversas novamente: 0 não lidas
        res = self.client_b.get('/api/conversas/')
        conversa = next(c for c in res.data if c['match_id'] == match_id)
        self.assertEqual(conversa['nao_lidas'], 0)

    def test_proprias_mensagens_nao_contam_como_nao_lidas(self):
        match_id = self._gerar_match()
        self.client_a.post(f'/api/matches/{match_id}/mensagens/', {'conteudo': 'Msg'}, format='json')

        res = self.client_a.get('/api/conversas/')
        conversa = next(c for c in res.data if c['match_id'] == match_id)
        self.assertEqual(conversa['nao_lidas'], 0)

    # 6. Terceiro usuário sem match é bloqueado

    def test_terceiro_usuario_nao_pode_ler_mensagens(self):
        match_id = self._gerar_match()
        self.client_a.post(f'/api/matches/{match_id}/mensagens/', {'conteudo': 'Privado'}, format='json')

        client_c = APIClient()
        _registrar_e_logar(client_c, 'buscando_vaga')
        _criar_perfil(client_c, 'Carlos')

        res = client_c.get(f'/api/matches/{match_id}/mensagens/')
        self.assertIn(res.status_code, [http_status.HTTP_403_FORBIDDEN, http_status.HTTP_404_NOT_FOUND])

    def test_terceiro_usuario_nao_pode_enviar_mensagem(self):
        match_id = self._gerar_match()

        client_c = APIClient()
        _registrar_e_logar(client_c, 'buscando_vaga')
        _criar_perfil(client_c, 'Diana')

        res = client_c.post(
            f'/api/matches/{match_id}/mensagens/',
            {'conteudo': 'Intruso'},
            format='json',
        )
        self.assertIn(res.status_code, [http_status.HTTP_403_FORBIDDEN, http_status.HTTP_404_NOT_FOUND])
