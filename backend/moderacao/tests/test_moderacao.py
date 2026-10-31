"""
Testes do módulo de moderação.

Cobre:
- DenunciaCreateView: criação, validações, restrições de perfil
- AdminDenunciaListView: listagem e filtros
- AdminDenunciaResolverView: resolução e descarte
- AdminSuspenderUsuarioView / AdminReativarUsuarioView
- Efeitos no discovery e no chat (usuários suspensos)
- Serviços: criar_denuncia, resolver_denuncia, suspender_usuario, reativar_usuario
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from moderacao.models import Denuncia
from moderacao.servicos import (
    criar_denuncia, resolver_denuncia,
    suspender_usuario, reativar_usuario,
)
from perfis.models import Perfil
from matches.models import Match

User = get_user_model()

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


def _criar_user(email, tipo, ativo=True):
    u = User.objects.create_user(
        username=email.replace('@', '_').replace('.', '_'),
        email=email,
        password='Teste@1234',
        tipo=tipo,
    )
    if not ativo:
        u.is_active = False
        u.save()
    return u


def _criar_perfil(usuario):
    return Perfil.objects.create(usuario=usuario, **_PERFIL_BASE)


class _Base(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user_b = _criar_user('b@t.local', 'buscando_vaga')
        cls.user_o = _criar_user('o@t.local', 'oferecendo_vaga')
        cls.user_b2 = _criar_user('b2@t.local', 'buscando_vaga')
        cls.user_adm = _criar_user('adm@t.local', 'administrador')

        cls.perfil_b = _criar_perfil(cls.user_b)
        cls.perfil_o = _criar_perfil(cls.user_o)
        cls.perfil_b2 = _criar_perfil(cls.user_b2)


# ─── Criação de denúncia ──────────────────────────────────────────────────────

class DenunciaCreateTest(_Base):

    def test_usuario_pode_denunciar(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.post('/api/moderacao/denuncias/', {
            'denunciado': self.user_o.id,
            'motivo': 'spam',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['status'], 'pendente')
        self.assertEqual(Denuncia.objects.count(), 1)

    def test_anonimo_nao_pode_denunciar(self):
        r = self.client.post('/api/moderacao/denuncias/', {
            'denunciado': self.user_o.id,
            'motivo': 'spam',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_nao_pode_denunciar(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.post('/api/moderacao/denuncias/', {
            'denunciado': self.user_b.id,
            'motivo': 'spam',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nao_pode_denunciar_a_si_mesmo(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.post('/api/moderacao/denuncias/', {
            'denunciado': self.user_b.id,
            'motivo': 'spam',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_motivo_invalido(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.post('/api/moderacao/denuncias/', {
            'denunciado': self.user_o.id,
            'motivo': 'motivo_inexistente',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_denunciado_inexistente(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.post('/api/moderacao/denuncias/', {
            'denunciado': 99999,
            'motivo': 'spam',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_campo_denunciado_obrigatorio(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.post('/api/moderacao/denuncias/', {
            'motivo': 'spam',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_denuncia_com_descricao(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.post('/api/moderacao/denuncias/', {
            'denunciado': self.user_o.id,
            'motivo': 'ofensivo',
            'descricao': 'Conteúdo impróprio no perfil.',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        d = Denuncia.objects.get(id=r.data['id'])
        self.assertEqual(d.descricao, 'Conteúdo impróprio no perfil.')


# ─── Listagem de denúncias (admin) ────────────────────────────────────────────

class AdminDenunciaListTest(_Base):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.d1 = Denuncia.objects.create(
            denunciante=cls.user_b, denunciado=cls.user_o,
            motivo='spam', status='pendente',
        )
        cls.d2 = Denuncia.objects.create(
            denunciante=cls.user_b2, denunciado=cls.user_o,
            motivo='falso', status='resolvida',
            resolvida_por=cls.user_adm,
        )

    def test_admin_pode_listar(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.get('/api/admin/moderacao/denuncias/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 2)

    def test_usuario_comum_nao_pode_listar(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.get('/api/admin/moderacao/denuncias/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonimo_nao_pode_listar(self):
        r = self.client.get('/api/admin/moderacao/denuncias/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_filtro_por_status(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.get('/api/admin/moderacao/denuncias/?status=pendente')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]['status'], 'pendente')

    def test_filtro_por_denunciado(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.get(f'/api/admin/moderacao/denuncias/?denunciado={self.user_o.id}')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 2)

    def test_filtro_por_motivo(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.get('/api/admin/moderacao/denuncias/?motivo=falso')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 1)


# ─── Resolução de denúncia (admin) ───────────────────────────────────────────

class AdminDenunciaResolverTest(_Base):

    def setUp(self):
        self.denuncia = Denuncia.objects.create(
            denunciante=self.user_b, denunciado=self.user_o,
            motivo='spam', status='pendente',
        )

    def test_admin_pode_resolver(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.patch(
            f'/api/admin/moderacao/denuncias/{self.denuncia.id}/',
            {'status': 'resolvida', 'resolucao': 'Usuário advertido.'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.denuncia.refresh_from_db()
        self.assertEqual(self.denuncia.status, 'resolvida')
        self.assertEqual(self.denuncia.resolvida_por, self.user_adm)

    def test_admin_pode_descartar(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.patch(
            f'/api/admin/moderacao/denuncias/{self.denuncia.id}/',
            {'status': 'descartada'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.denuncia.refresh_from_db()
        self.assertEqual(self.denuncia.status, 'descartada')

    def test_usuario_comum_nao_pode_resolver(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.patch(
            f'/api/admin/moderacao/denuncias/{self.denuncia.id}/',
            {'status': 'resolvida'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_denuncia_inexistente_retorna_404(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.patch('/api/admin/moderacao/denuncias/99999/', {'status': 'resolvida'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_status_invalido_retorna_400(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.patch(
            f'/api/admin/moderacao/denuncias/{self.denuncia.id}/',
            {'status': 'invalido'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nao_pode_resolver_denuncia_ja_resolvida(self):
        self.denuncia.status = 'resolvida'
        self.denuncia.save()
        self.client.force_authenticate(self.user_adm)
        r = self.client.patch(
            f'/api/admin/moderacao/denuncias/{self.denuncia.id}/',
            {'status': 'descartada'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


# ─── Suspensão e reativação ───────────────────────────────────────────────────

class SuspensaoTest(_Base):

    def test_admin_pode_suspender(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.post(
            f'/api/admin/moderacao/usuarios/{self.user_b.id}/suspender/',
            {'motivo': 'Spam repetido.'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user_b.refresh_from_db()
        self.assertFalse(self.user_b.is_active)

    def test_usuario_comum_nao_pode_suspender(self):
        self.client.force_authenticate(self.user_o)
        r = self.client.post(
            f'/api/admin/moderacao/usuarios/{self.user_b.id}/suspender/',
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_nao_pode_suspender_admin(self):
        adm2 = _criar_user('adm2@t.local', 'administrador')
        self.client.force_authenticate(self.user_adm)
        r = self.client.post(
            f'/api/admin/moderacao/usuarios/{adm2.id}/suspender/',
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_suspender_ja_suspenso_retorna_400(self):
        self.user_b.is_active = False
        self.user_b.save()
        self.client.force_authenticate(self.user_adm)
        r = self.client.post(
            f'/api/admin/moderacao/usuarios/{self.user_b.id}/suspender/',
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        # Restaura estado para outros testes
        self.user_b.is_active = True
        self.user_b.save()

    def test_usuario_inexistente_retorna_404(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.post('/api/admin/moderacao/usuarios/99999/suspender/', format='json')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_pode_reativar(self):
        self.user_b2.is_active = False
        self.user_b2.save()
        self.client.force_authenticate(self.user_adm)
        r = self.client.post(
            f'/api/admin/moderacao/usuarios/{self.user_b2.id}/reativar/',
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user_b2.refresh_from_db()
        self.assertTrue(self.user_b2.is_active)

    def test_reativar_ja_ativo_retorna_400(self):
        self.client.force_authenticate(self.user_adm)
        r = self.client.post(
            f'/api/admin/moderacao/usuarios/{self.user_b.id}/reativar/',
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_usuario_comum_nao_pode_reativar(self):
        self.user_b2.is_active = False
        self.user_b2.save()
        self.client.force_authenticate(self.user_o)
        r = self.client.post(
            f'/api/admin/moderacao/usuarios/{self.user_b2.id}/reativar/',
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        # Restaura
        self.user_b2.is_active = True
        self.user_b2.save()


# ─── Efeitos na descoberta e no chat ─────────────────────────────────────────

class SuspensaoEfeitosTest(_Base):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.user_o_susp = _criar_user('o_susp@t.local', 'oferecendo_vaga', ativo=False)
        cls.perfil_o_susp = _criar_perfil(cls.user_o_susp)
        # Match entre user_b e user_o_susp (para teste de chat)
        pa = min(cls.perfil_b.id, cls.perfil_o_susp.id)
        pb = max(cls.perfil_b.id, cls.perfil_o_susp.id)
        cls.match_susp = Match.objects.create(perfil_a_id=pa, perfil_b_id=pb, score=0.8)

    def test_usuario_suspenso_nao_aparece_na_descoberta(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.get('/api/descoberta/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids_retornados = [p['id'] for p in r.data]
        self.assertNotIn(self.perfil_o_susp.id, ids_retornados)

    def test_match_com_suspenso_nao_aparece_na_lista(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.get('/api/matches/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids_matches = [m['id'] for m in r.data]
        self.assertNotIn(self.match_susp.id, ids_matches)

    def test_match_com_suspenso_nao_aparece_nas_conversas(self):
        self.client.force_authenticate(self.user_b)
        r = self.client.get('/api/conversas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids_matches = [c['match_id'] for c in r.data]
        self.assertNotIn(self.match_susp.id, ids_matches)


# ─── Serviços (unit) ─────────────────────────────────────────────────────────

class ServicosTest(_Base):

    def test_criar_denuncia_service(self):
        d = criar_denuncia(self.user_b, self.user_o.id, 'spam')
        self.assertEqual(d.status, 'pendente')
        self.assertEqual(d.denunciante, self.user_b)

    def test_criar_denuncia_mesmo_usuario_levanta_erro(self):
        with self.assertRaises(ValueError):
            criar_denuncia(self.user_b, self.user_b.id, 'spam')

    def test_criar_denuncia_admin_levanta_erro(self):
        with self.assertRaises(ValueError):
            criar_denuncia(self.user_adm, self.user_b.id, 'spam')

    def test_resolver_denuncia_service(self):
        d = Denuncia.objects.create(
            denunciante=self.user_b, denunciado=self.user_o, motivo='spam'
        )
        resolver_denuncia(d, self.user_adm, 'resolvida', 'Advertência enviada.')
        d.refresh_from_db()
        self.assertEqual(d.status, 'resolvida')
        self.assertEqual(d.resolvida_por, self.user_adm)

    def test_resolver_denuncia_ja_resolvida_levanta_erro(self):
        d = Denuncia.objects.create(
            denunciante=self.user_b, denunciado=self.user_o,
            motivo='spam', status='resolvida',
        )
        with self.assertRaises(ValueError):
            resolver_denuncia(d, self.user_adm, 'descartada')

    def test_suspender_usuario_service(self):
        u = _criar_user('tmp@t.local', 'buscando_vaga')
        suspender_usuario(u, self.user_adm, 'Teste')
        u.refresh_from_db()
        self.assertFalse(u.is_active)

    def test_suspender_ja_suspenso_levanta_erro(self):
        u = _criar_user('tmp2@t.local', 'buscando_vaga', ativo=False)
        with self.assertRaises(ValueError):
            suspender_usuario(u, self.user_adm)

    def test_reativar_usuario_service(self):
        u = _criar_user('tmp3@t.local', 'buscando_vaga', ativo=False)
        reativar_usuario(u, self.user_adm)
        u.refresh_from_db()
        self.assertTrue(u.is_active)

    def test_reativar_ja_ativo_levanta_erro(self):
        with self.assertRaises(ValueError):
            reativar_usuario(self.user_b, self.user_adm)
