"""
Matriz de permissões — testes automatizados.

Cada teste verifica um único caso de acesso (rota × perfil de usuário).
Execute com:
    python manage.py test painel.tests.test_permissoes --settings=placematch.test_settings
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from matches.models import Match

User = get_user_model()

# ─── Helpers ──────────────────────────────────────────────────────────────────

_PERFIL_BASE = dict(
    nome='Teste', idade=25, regiao='Recife', bio='',
    orcamento_min=500, orcamento_max=1500,
    fumante=False, aceita_pets=True,
    tolerancia_bagunca=3, nivel_organizacao=3,
    perfil_horario='flexivel',
    nivel_ruido=3, nivel_social=3,
    aceita_visitas='as_vezes',
    tipo_imovel='apartamento',
    qtd_moradores=2,
)


def _usuario(email, tipo='buscando_vaga', ativo=True):
    from django.contrib.auth import get_user_model
    U = get_user_model()
    u = U.objects.create_user(
        username=email.replace('@', '_').replace('.', '_'),
        email=email,
        password='Senha@1234',
        tipo=tipo,
    )
    u.is_active = ativo
    u.save(update_fields=['is_active'])
    return u


def _perfil(usuario, **extra):
    from perfis.models import Perfil
    dados = {**_PERFIL_BASE, **extra}
    return Perfil.objects.create(usuario=usuario, **dados)


def _match(pa, pb):
    a = min(pa.id, pb.id)
    b = max(pa.id, pb.id)
    return Match.objects.get_or_create(perfil_a_id=a, perfil_b_id=b, defaults={'score': 0.8})[0]


# ─── Cenário compartilhado ────────────────────────────────────────────────────

class _Base(APITestCase):
    """
    Cria um cenário mínimo:
      user_b  (buscando_vaga)   + perfil_b
      user_o  (oferecendo_vaga) + perfil_o
      user_o2 (oferecendo_vaga) + perfil_o2   ← terceiro, sem match com user_b
      user_b2 (buscando_vaga)   + perfil_b2   ← mesmo tipo que user_b
      admin   (administrador)   — sem perfil
      match   entre perfil_b e perfil_o
    """

    @classmethod
    def setUpTestData(cls):
        cls.user_b  = _usuario('b@pm.test', 'buscando_vaga')
        cls.user_o  = _usuario('o@pm.test', 'oferecendo_vaga')
        cls.user_o2 = _usuario('o2@pm.test', 'oferecendo_vaga')
        cls.user_b2 = _usuario('b2@pm.test', 'buscando_vaga')
        cls.admin   = _usuario('adm@pm.test', 'administrador')

        cls.perfil_b  = _perfil(cls.user_b)
        cls.perfil_o  = _perfil(cls.user_o)
        cls.perfil_o2 = _perfil(cls.user_o2)
        cls.perfil_b2 = _perfil(cls.user_b2)

        cls.match = _match(cls.perfil_b, cls.perfil_o)


# ─── Grupo 1: sem token → 401 em todas as rotas protegidas ───────────────────

class SemTokenTest(_Base):
    """Requisições sem JWT devem retornar 401 em qualquer rota autenticada."""

    def _401(self, method, path, **kwargs):
        fn = getattr(self.client, method)
        r = fn(path, **kwargs)
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED,
                         f'{method.upper()} {path} esperava 401, obteve {r.status_code}')

    def test_sem_token_perfis_lista(self):
        self._401('get', '/api/perfis/')

    def test_sem_token_perfis_detalhe(self):
        self._401('get', f'/api/perfis/{self.perfil_b.id}/')

    def test_sem_token_descoberta(self):
        self._401('get', '/api/descoberta/')

    def test_sem_token_curtidas(self):
        self._401('post', '/api/curtidas/', data={}, format='json')

    def test_sem_token_matches(self):
        self._401('get', '/api/matches/')

    def test_sem_token_conversas(self):
        self._401('get', '/api/conversas/')

    def test_sem_token_mensagens(self):
        self._401('get', f'/api/matches/{self.match.id}/mensagens/')

    def test_sem_token_admin_logs(self):
        self._401('get', '/api/admin/logs/')

    def test_sem_token_admin_logs_exportar(self):
        self._401('get', '/api/admin/logs/exportar/')

    def test_sem_token_admin_dashboard(self):
        self._401('get', '/api/admin/dashboard/')

    def test_sem_token_admin_relatorios(self):
        self._401('get', '/api/admin/relatorios/')

    def test_sem_token_admin_relatorio_detalhe(self):
        self._401('get', '/api/admin/relatorios/matches/')

    def test_sem_token_admin_usuarios(self):
        self._401('get', '/api/admin/usuarios/')

    def test_sem_token_admin_usuarios_exportar(self):
        self._401('get', '/api/admin/usuarios/exportar/')


# ─── Grupo 2: usuário comum → 403 em rotas /api/admin/ ───────────────────────

class UsuarioComumAdminTest(_Base):
    """buscando_vaga e oferecendo_vaga devem receber 403 em todas as rotas admin."""

    def _403_admin(self, user, path):
        self.client.force_authenticate(user=user)
        r = self.client.get(path)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN,
                         f'User {user.tipo} em {path}: esperava 403, obteve {r.status_code}')

    def _rotas_admin(self):
        return [
            '/api/admin/logs/',
            '/api/admin/logs/exportar/',
            '/api/admin/dashboard/',
            '/api/admin/relatorios/',
            '/api/admin/relatorios/matches/',
            '/api/admin/usuarios/',
            '/api/admin/usuarios/exportar/',
        ]

    def test_buscando_bloqueado_em_logs(self):
        self._403_admin(self.user_b, '/api/admin/logs/')

    def test_buscando_bloqueado_em_logs_exportar(self):
        self._403_admin(self.user_b, '/api/admin/logs/exportar/')

    def test_buscando_bloqueado_em_dashboard(self):
        self._403_admin(self.user_b, '/api/admin/dashboard/')

    def test_buscando_bloqueado_em_relatorios(self):
        self._403_admin(self.user_b, '/api/admin/relatorios/')

    def test_buscando_bloqueado_em_relatorio_detalhe(self):
        self._403_admin(self.user_b, '/api/admin/relatorios/matches/')

    def test_buscando_bloqueado_em_usuarios(self):
        self._403_admin(self.user_b, '/api/admin/usuarios/')

    def test_buscando_bloqueado_em_usuarios_exportar(self):
        self._403_admin(self.user_b, '/api/admin/usuarios/exportar/')

    def test_oferecendo_bloqueado_em_logs(self):
        self._403_admin(self.user_o, '/api/admin/logs/')

    def test_oferecendo_bloqueado_em_logs_exportar(self):
        self._403_admin(self.user_o, '/api/admin/logs/exportar/')

    def test_oferecendo_bloqueado_em_dashboard(self):
        self._403_admin(self.user_o, '/api/admin/dashboard/')

    def test_oferecendo_bloqueado_em_relatorios(self):
        self._403_admin(self.user_o, '/api/admin/relatorios/')

    def test_oferecendo_bloqueado_em_relatorio_detalhe(self):
        self._403_admin(self.user_o, '/api/admin/relatorios/matches/')

    def test_oferecendo_bloqueado_em_usuarios(self):
        self._403_admin(self.user_o, '/api/admin/usuarios/')

    def test_oferecendo_bloqueado_em_usuarios_exportar(self):
        self._403_admin(self.user_o, '/api/admin/usuarios/exportar/')


# ─── Grupo 3: administrador → 200 nas rotas /api/admin/ ──────────────────────

class AdminAcessoTest(_Base):
    """Administrador deve receber 200 em todas as rotas admin."""

    def setUp(self):
        self.client.force_authenticate(user=self.admin)

    def test_admin_acessa_logs(self):
        r = self.client.get('/api/admin/logs/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_acessa_logs_exportar(self):
        r = self.client.get('/api/admin/logs/exportar/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_acessa_dashboard(self):
        r = self.client.get('/api/admin/dashboard/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_acessa_relatorios(self):
        r = self.client.get('/api/admin/relatorios/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_acessa_relatorio_detalhe(self):
        r = self.client.get('/api/admin/relatorios/matches/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_acessa_usuarios(self):
        r = self.client.get('/api/admin/usuarios/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_acessa_usuarios_exportar(self):
        r = self.client.get('/api/admin/usuarios/exportar/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ─── Grupo 4: chat alheio → 403 ──────────────────────────────────────────────

class ChatAcessoTest(_Base):
    """Apenas participantes do match podem ler/enviar mensagens."""

    def test_participante_le_mensagens(self):
        self.client.force_authenticate(user=self.user_b)
        r = self.client.get(f'/api/matches/{self.match.id}/mensagens/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_nao_participante_nao_le_mensagens(self):
        # user_o2 não faz parte do match entre user_b e user_o
        self.client.force_authenticate(user=self.user_o2)
        r = self.client.get(f'/api/matches/{self.match.id}/mensagens/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_nao_participante_nao_envia_mensagem(self):
        self.client.force_authenticate(user=self.user_o2)
        r = self.client.post(
            f'/api/matches/{self.match.id}/mensagens/',
            {'conteudo': 'oi'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_participante_envia_mensagem(self):
        self.client.force_authenticate(user=self.user_o)
        r = self.client.post(
            f'/api/matches/{self.match.id}/mensagens/',
            {'conteudo': 'olá!'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)


# ─── Grupo 5: perfil alheio → 403 para edição/exclusão ───────────────────────

class PerfilAcessoEscritaTest(_Base):
    """Usuário comum não pode editar nem excluir perfil de terceiro."""

    def test_nao_dono_nao_edita_perfil(self):
        self.client.force_authenticate(user=self.user_o)
        r = self.client.patch(
            f'/api/perfis/{self.perfil_b.id}/',
            {'bio': 'invasão'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_nao_dono_nao_exclui_perfil(self):
        self.client.force_authenticate(user=self.user_o)
        r = self.client.delete(f'/api/perfis/{self.perfil_b.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_dono_edita_proprio_perfil(self):
        self.client.force_authenticate(user=self.user_b)
        r = self.client.patch(
            f'/api/perfis/{self.perfil_b.id}/',
            {'bio': 'nova bio'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_ve_perfil_alheio(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/perfis/{self.perfil_b.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ─── Grupo 6: GET /api/perfis/ retorna só o próprio perfil ───────────────────

class ListaPerfisPropriasTest(_Base):
    """GET /api/perfis/ de usuário comum deve retornar apenas o próprio perfil."""

    def test_lista_retorna_apenas_proprio(self):
        self.client.force_authenticate(user=self.user_b)
        r = self.client.get('/api/perfis/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in r.data]
        self.assertEqual(ids, [self.perfil_b.id])

    def test_lista_nao_retorna_perfis_de_terceiros(self):
        self.client.force_authenticate(user=self.user_b)
        r = self.client.get('/api/perfis/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        # perfil_o, perfil_o2, perfil_b2 não devem aparecer
        ids = [p['id'] for p in r.data]
        self.assertNotIn(self.perfil_o.id, ids)
        self.assertNotIn(self.perfil_o2.id, ids)
        self.assertNotIn(self.perfil_b2.id, ids)

    def test_admin_ve_todos_os_perfis(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/perfis/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = {p['id'] for p in r.data}
        for pid in (self.perfil_b.id, self.perfil_o.id, self.perfil_o2.id, self.perfil_b2.id):
            self.assertIn(pid, ids)

    def test_usuario_sem_perfil_recebe_lista_vazia(self):
        self.client.force_authenticate(user=self.admin)
        # Admin não tem perfil — mas como admin vê todos, não é vazia.
        # Testamos com um usuário buscando sem perfil.
        user_novo = _usuario('novo@pm.test', 'buscando_vaga')
        self.client.force_authenticate(user=user_novo)
        r = self.client.get('/api/perfis/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data, [])


# ─── Grupo 7: acesso a perfil de tipo oposto vs. mesmo tipo ──────────────────

class PerfilRetrieveTest(_Base):
    """GET /api/perfis/{id}/ — regras de visibilidade por tipo."""

    def test_buscando_ve_perfil_oposto(self):
        self.client.force_authenticate(user=self.user_b)
        r = self.client.get(f'/api/perfis/{self.perfil_o.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_buscando_nao_ve_perfil_mesmo_tipo_sem_match(self):
        # user_b (buscando) tenta ver perfil_b2 (outro buscando) — sem match
        self.client.force_authenticate(user=self.user_b)
        r = self.client.get(f'/api/perfis/{self.perfil_b2.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_participante_ve_perfil_do_match(self):
        # user_b tem match com user_o; já coberto no teste oposto acima,
        # mas verifica o caminho inverso: user_o vê perfil_b via match.
        self.client.force_authenticate(user=self.user_o)
        r = self.client.get(f'/api/perfis/{self.perfil_b.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ─── Grupo 8: cadastro com tipo=administrador → 400 ─────────────────────────

class CadastroTipoAdminTest(APITestCase):
    """API de registro deve rejeitar tipo='administrador'."""

    def test_cadastro_tipo_administrador_rejeitado(self):
        r = self.client.post('/api/auth/registrar/', {
            'username': 'hacker',
            'email': 'hacker@pm.test',
            'password': 'Senha@1234',
            'tipo': 'administrador',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cadastro_tipo_administrador_mensagem_portugues(self):
        r = self.client.post('/api/auth/registrar/', {
            'username': 'hacker2',
            'email': 'hacker2@pm.test',
            'password': 'Senha@1234',
            'tipo': 'administrador',
        }, format='json')
        detail = str(r.data)
        self.assertNotIn('is not a valid choice', detail,
                         'Mensagem de erro não foi traduzida para português')

    def test_cadastro_tipo_valido_aceito(self):
        r = self.client.post('/api/auth/registrar/', {
            'username': 'valido',
            'email': 'valido@pm.test',
            'password': 'Senha@1234',
            'tipo': 'buscando_vaga',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)


# ─── Grupo 9: curtida entre mesmo tipo → 400 ─────────────────────────────────

class CurtidaMesmoTipoTest(_Base):
    """CurtidaView deve rejeitar curtidas entre perfis do mesmo tipo."""

    def test_curtida_mesmo_tipo_retorna_400(self):
        # user_b (buscando) tenta curtir perfil_b2 (também buscando)
        self.client.force_authenticate(user=self.user_b)
        r = self.client.post('/api/curtidas/', {
            'perfil_destino': self.perfil_b2.id,
            'tipo': 'curtir',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_curtida_mesmo_tipo_mensagem_portugues(self):
        self.client.force_authenticate(user=self.user_b)
        r = self.client.post('/api/curtidas/', {
            'perfil_destino': self.perfil_b2.id,
            'tipo': 'curtir',
        }, format='json')
        self.assertIn('oposto', r.data.get('detail', '').lower())

    def test_admin_nao_pode_curtir(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post('/api/curtidas/', {
            'perfil_destino': self.perfil_b.id,
            'tipo': 'curtir',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_curtida_tipo_oposto_aceita(self):
        self.client.force_authenticate(user=self.user_b)
        r = self.client.post('/api/curtidas/', {
            'perfil_destino': self.perfil_o2.id,
            'tipo': 'curtir',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)


# ─── Grupo 10: login com conta inativa → 401 PT-BR ───────────────────────────

class LoginContaInativaTest(APITestCase):
    """Login de conta inativa deve retornar 401 com mensagem em português."""

    def setUp(self):
        self.user_inativo = _usuario('inativo@pm.test', 'buscando_vaga', ativo=False)

    def test_login_conta_inativa_retorna_401(self):
        r = self.client.post('/api/auth/login/', {
            'email': 'inativo@pm.test',
            'password': 'Senha@1234',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_conta_inativa_mensagem_portugues(self):
        r = self.client.post('/api/auth/login/', {
            'email': 'inativo@pm.test',
            'password': 'Senha@1234',
        }, format='json')
        detail = r.data.get('detail', '')
        self.assertIn('suspensa', detail.lower(),
                      f'Mensagem esperada sobre conta suspensa, obteve: {detail!r}')
        self.assertNotIn('no active account', detail.lower())

    def test_login_senha_errada_mensagem_portugues(self):
        r = self.client.post('/api/auth/login/', {
            'email': 'inativo@pm.test',
            'password': 'SenhaErrada99',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        detail = r.data.get('detail', '')
        self.assertIn('incorretos', detail.lower(),
                      f'Mensagem esperada sobre credenciais, obteve: {detail!r}')
