"""
Testes de ponta a ponta e regras de negócio do PlaceMatch.

• FluxoCompletoTest.test_fluxo_completo  — 12 passos sequenciais imprimindo
  "[OK] N. descrição → HTTP status" a cada asserção.

• regra_* — testes isolados de regras de negócio que não são cobertas
  por outros arquivos de teste.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status as http_status

from matches.models import Compatibilidade, Curtida, Match
from moderacao.models import Denuncia
from perfis.models import Perfil

User = get_user_model()

# ─── helpers ─────────────────────────────────────────────────────────────────

_PERFIL_BASE = dict(
    nome='Teste', idade=25, regiao='Recife', bio='Bio teste',
    orcamento_min=500, orcamento_max=1500,
    fumante=False, aceita_pets=True,
    tolerancia_bagunca=3, nivel_organizacao=3,
    perfil_horario='flexivel',
    nivel_ruido=3, nivel_social=3,
    aceita_visitas='as_vezes',
    tipo_imovel='apartamento',
    qtd_moradores=2,
)


def _ok(step, desc, got):
    """Imprime a linha de progresso."""
    print(f'[OK] {step}. {desc} -> {got}')


# ─── Fluxo completo ──────────────────────────────────────────────────────────

class FluxoCompletoTest(TestCase):

    def test_fluxo_completo(self):
        """
        Percorre os 12 passos principais da plataforma em sequência,
        imprimindo "[OK] N. descrição → status HTTP" a cada verificação.
        """
        c_a = APIClient()   # buscando_vaga
        c_b = APIClient()   # oferecendo_vaga
        c_adm = APIClient() # administrador

        # ── Passo 1: Cadastro ─────────────────────────────────────────────────
        res = c_a.post('/api/auth/registrar/', {
            'username': 'user_a', 'email': 'a@test.com',
            'password': 'Senha@1234', 'tipo': 'buscando_vaga',
        })
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        _ok(1, 'Cadastro usuário A (buscando_vaga)', res.status_code)

        res = c_b.post('/api/auth/registrar/', {
            'username': 'user_b', 'email': 'b@test.com',
            'password': 'Senha@1234', 'tipo': 'oferecendo_vaga',
        })
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        _ok(1, 'Cadastro usuário B (oferecendo_vaga)', res.status_code)

        # Tentativa de auto-cadastro como admin → deve ser recusada
        res_adm_block = c_a.post('/api/auth/registrar/', {
            'username': 'fake_adm', 'email': 'fake_adm@test.com',
            'password': 'Senha@1234', 'tipo': 'administrador',
        })
        self.assertIn(res_adm_block.status_code,
                      [http_status.HTTP_400_BAD_REQUEST,
                       http_status.HTTP_403_FORBIDDEN])
        _ok(1, 'Auto-cadastro como admin bloqueado', res_adm_block.status_code)

        # Cria admin diretamente (sem API)
        admin = User.objects.create_user(
            username='adm', email='adm@test.com',
            password='Admin@1234', tipo='administrador',
        )

        # ── Passo 2: Login e /api/auth/me/ ───────────────────────────────────
        res = c_a.post('/api/auth/login/', {'email': 'a@test.com', 'password': 'Senha@1234'})
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        c_a.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        _ok(2, 'Login usuário A', res.status_code)

        res = c_b.post('/api/auth/login/', {'email': 'b@test.com', 'password': 'Senha@1234'})
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        c_b.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        _ok(2, 'Login usuário B', res.status_code)

        c_adm.force_authenticate(user=admin)

        res = c_a.get('/api/auth/me/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        self.assertEqual(res.data['tipo'], 'buscando_vaga')
        _ok(2, '/api/auth/me/ retorna tipo correto para A', res.status_code)

        # ── Passo 3: Criação de perfil ────────────────────────────────────────
        # Orçamento mínimo > máximo deve ser rejeitado
        res_invalido = c_a.post('/api/perfis/', {
            **_PERFIL_BASE, 'orcamento_min': 2000, 'orcamento_max': 500,
        })
        self.assertIn(res_invalido.status_code,
                      [http_status.HTTP_400_BAD_REQUEST])
        _ok(3, 'Perfil com orcamento_min > orcamento_max rejeitado', res_invalido.status_code)

        res = c_a.post('/api/perfis/', {**_PERFIL_BASE, 'nome': 'Usuário A'})
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        perfil_a_id = res.data['id']
        _ok(3, 'Criação de perfil A', res.status_code)

        res = c_b.post('/api/perfis/', {**_PERFIL_BASE, 'nome': 'Usuário B'})
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        perfil_b_id = res.data['id']
        _ok(3, 'Criação de perfil B', res.status_code)

        # Garantir que o score de compatibilidade existe
        pa_id = min(perfil_a_id, perfil_b_id)
        pb_id = max(perfil_a_id, perfil_b_id)
        Compatibilidade.objects.get_or_create(
            perfil_a_id=pa_id, perfil_b_id=pb_id,
            defaults={'score': 0.85},
        )

        # ── Passo 4: Descoberta ───────────────────────────────────────────────
        res = c_a.get('/api/descoberta/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        ids_descobertos = [p['id'] for p in res.data]
        self.assertIn(perfil_b_id, ids_descobertos)
        _ok(4, 'A enxerga B na descoberta', res.status_code)

        # Admin recebe 403 na descoberta
        res_adm = c_adm.get('/api/descoberta/')
        self.assertEqual(res_adm.status_code, http_status.HTTP_403_FORBIDDEN)
        _ok(4, 'Admin recebe 403 na descoberta', res_adm.status_code)

        # ── Passo 5: Curtidas e match ─────────────────────────────────────────
        # A curte B
        res = c_a.post('/api/curtidas/', {'perfil_destino': perfil_b_id, 'tipo': 'curtir'})
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        self.assertFalse(res.data.get('match'))  # B ainda não curtiu A
        _ok(5, 'A curte B (sem match ainda)', res.status_code)

        # A tenta curtir B novamente → erro
        res_dup = c_a.post('/api/curtidas/', {'perfil_destino': perfil_b_id, 'tipo': 'curtir'})
        self.assertEqual(res_dup.status_code, http_status.HTTP_400_BAD_REQUEST)
        _ok(5, 'Curtida duplicada rejeitada', res_dup.status_code)

        # B curte A → match criado
        res = c_b.post('/api/curtidas/', {'perfil_destino': perfil_a_id, 'tipo': 'curtir'})
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('match'))
        match_id = res.data['match_data']['id']
        _ok(5, 'B curte A -> match criado', res.status_code)

        # ── Passo 6: Descoberta pós-match ─────────────────────────────────────
        res = c_a.get('/api/descoberta/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        ids_pos_match = [p['id'] for p in res.data]
        self.assertNotIn(perfil_b_id, ids_pos_match)
        _ok(6, 'B desaparece da descoberta de A após match', res.status_code)

        # ── Passo 7: Chat ─────────────────────────────────────────────────────
        # Admin recebe 403 em conversas
        res_adm = c_adm.get('/api/conversas/')
        self.assertEqual(res_adm.status_code, http_status.HTTP_403_FORBIDDEN)
        _ok(7, 'Admin recebe 403 em /api/conversas/', res_adm.status_code)

        # A lista conversas → aparece o match
        res = c_a.get('/api/conversas/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        match_ids_conv = [c['match_id'] for c in res.data]
        self.assertIn(match_id, match_ids_conv)
        _ok(7, 'A visualiza conversa do match', res.status_code)

        # A envia mensagem
        res = c_a.post(f'/api/matches/{match_id}/mensagens/', {'conteudo': 'Olá!'})
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        _ok(7, 'A envia mensagem no chat', res.status_code)

        # Mensagem vazia rejeitada
        res_vazio = c_a.post(f'/api/matches/{match_id}/mensagens/', {'conteudo': '   '})
        self.assertEqual(res_vazio.status_code, http_status.HTTP_400_BAD_REQUEST)
        _ok(7, 'Mensagem vazia rejeitada', res_vazio.status_code)

        # Mensagem com mais de 1000 chars rejeitada
        res_longa = c_a.post(f'/api/matches/{match_id}/mensagens/', {'conteudo': 'x' * 1001})
        self.assertEqual(res_longa.status_code, http_status.HTTP_400_BAD_REQUEST)
        _ok(7, 'Mensagem com >1000 chars rejeitada', res_longa.status_code)

        # B lê mensagens
        res = c_b.get(f'/api/matches/{match_id}/mensagens/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 1)
        _ok(7, 'B recebe mensagens do chat', res.status_code)

        # ── Passo 8: Denúncia e suspensão ─────────────────────────────────────
        user_b_obj = User.objects.get(email='b@test.com')

        res = c_a.post('/api/moderacao/denuncias/', {
            'denunciado': user_b_obj.id,
            'motivo': 'spam',
            'descricao': 'Muitas mensagens repetidas.',
        })
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        denuncia_id = res.data['id']
        _ok(8, 'A denuncia B', res.status_code)

        # Admin resolve como "resolvida" (procedente)
        res = c_adm.patch(f'/api/admin/moderacao/denuncias/{denuncia_id}/', {
            'status': 'resolvida',
            'resolucao': 'Denúncia procedente.',
        })
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'resolvida')
        _ok(8, 'Admin resolve denúncia como "resolvida"', res.status_code)

        # Admin suspende B
        res = c_adm.post(f'/api/admin/moderacao/usuarios/{user_b_obj.id}/suspender/',
                         {'motivo': 'Comportamento abusivo.'})
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        self.assertFalse(res.data['ativo'])
        _ok(8, 'Admin suspende B', res.status_code)

        # ── Passo 9: Login suspenso → 401 ────────────────────────────────────
        c_b_novo = APIClient()
        res = c_b_novo.post('/api/auth/login/', {'email': 'b@test.com', 'password': 'Senha@1234'})
        self.assertEqual(res.status_code, http_status.HTTP_401_UNAUTHORIZED)
        _ok(9, 'Login de conta suspensa retorna 401', res.status_code)

        # ── Passo 10: Reativação ──────────────────────────────────────────────
        res = c_adm.post(f'/api/admin/moderacao/usuarios/{user_b_obj.id}/reativar/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        self.assertTrue(res.data['ativo'])
        _ok(10, 'Admin reativa B', res.status_code)

        # B consegue logar novamente
        res = c_b_novo.post('/api/auth/login/', {'email': 'b@test.com', 'password': 'Senha@1234'})
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        _ok(10, 'B loga com sucesso após reativação', res.status_code)

        # ── Passo 11: Dashboard, relatórios e logs (admin) ───────────────────
        res = c_adm.get('/api/admin/dashboard/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        _ok(11, 'Admin acessa dashboard', res.status_code)

        res = c_adm.get('/api/admin/relatorios/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        _ok(11, 'Admin acessa catálogo de relatórios', res.status_code)

        res = c_adm.get('/api/admin/relatorios/compatibilidade-regiao/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        _ok(11, 'Admin acessa relatorio compatibilidade-regiao', res.status_code)

        res = c_adm.get('/api/admin/relatorios/denuncias/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        _ok(11, 'Admin acessa relatorio denuncias', res.status_code)

        # ── Passo 12: Usuário comum recebe 403 em rotas de admin ─────────────
        rotas_admin = [
            '/api/admin/dashboard/',
            '/api/admin/moderacao/denuncias/',
            f'/api/admin/moderacao/usuarios/{user_b_obj.id}/suspender/',
            '/api/admin/relatorios/',
        ]
        for rota in rotas_admin:
            method = 'post' if 'suspender' in rota else 'get'
            res_comum = getattr(c_a, method)(rota)
            self.assertIn(res_comum.status_code,
                          [http_status.HTTP_403_FORBIDDEN,
                           http_status.HTTP_401_UNAUTHORIZED],
                          msg=f'Esperado 403/401 em {rota}, got {res_comum.status_code}')
            _ok(12, f'Usuário comum bloqueado em {rota}', res_comum.status_code)

        print('\n[FLUXO COMPLETO] Todos os 12 passos verificados com sucesso.')


# ─── Regras de negócio ────────────────────────────────────────────────────────

class RegrasMatchUnicoTest(TestCase):
    """Regra: Match é único por par de perfis."""

    def setUp(self):
        self.u_a = User.objects.create_user(
            username='rma', email='rma@test.com', password='Senha@1234',
            tipo='buscando_vaga')
        self.u_b = User.objects.create_user(
            username='rmb', email='rmb@test.com', password='Senha@1234',
            tipo='oferecendo_vaga')
        self.p_a = Perfil.objects.create(usuario=self.u_a, **_PERFIL_BASE)
        self.p_b = Perfil.objects.create(usuario=self.u_b, **_PERFIL_BASE)

    def test_regra_match_unico_por_par(self):
        """get_or_create garante no máximo um Match por par."""
        pa = min(self.p_a.id, self.p_b.id)
        pb = max(self.p_a.id, self.p_b.id)
        m1, criado1 = Match.objects.get_or_create(
            perfil_a_id=pa, perfil_b_id=pb, defaults={'score': 0.5})
        m2, criado2 = Match.objects.get_or_create(
            perfil_a_id=pa, perfil_b_id=pb, defaults={'score': 0.9})
        self.assertTrue(criado1)
        self.assertFalse(criado2)
        self.assertEqual(m1.id, m2.id)
        self.assertEqual(Match.objects.filter(perfil_a_id=pa, perfil_b_id=pb).count(), 1)


class RegraExclusaoPerfilTest(TestCase):
    """Regra: excluir perfil remove curtidas/matches/mensagens; logs ficam com usuario=NULL."""

    def setUp(self):
        from chat.models import Mensagem
        self.Mensagem = Mensagem

        self.u_a = User.objects.create_user(
            username='del_a', email='del_a@test.com', password='Senha@1234',
            tipo='buscando_vaga')
        self.u_b = User.objects.create_user(
            username='del_b', email='del_b@test.com', password='Senha@1234',
            tipo='oferecendo_vaga')
        self.p_a = Perfil.objects.create(usuario=self.u_a, **_PERFIL_BASE)
        self.p_b = Perfil.objects.create(usuario=self.u_b, **_PERFIL_BASE)

        Curtida.objects.create(perfil_origem=self.p_a, perfil_destino=self.p_b, tipo='curtir')
        Curtida.objects.create(perfil_origem=self.p_b, perfil_destino=self.p_a, tipo='curtir')

        pa = min(self.p_a.id, self.p_b.id)
        pb = max(self.p_a.id, self.p_b.id)
        self.match = Match.objects.create(perfil_a_id=pa, perfil_b_id=pb, score=0.7)
        self.Mensagem.objects.create(
            match=self.match, remetente=self.p_a, conteudo='Olá')

        # Gera ao menos um log para u_a
        from logs.servicos import registrar
        registrar('CADASTRO', usuario=self.u_a, entidade='usuario',
                  entidade_id=self.u_a.id)

    def test_regra_exclusao_perfil_remove_curtidas_matches_mensagens(self):
        """Após excluir usuário A: curtidas, match e mensagens são removidos."""
        from logs.models import LogOperacao
        p_a_id = self.p_a.id

        self.u_a.delete()

        self.assertEqual(
            Curtida.objects.filter(perfil_origem_id=p_a_id).count(), 0,
            'Curtidas de origem de A devem ser removidas')
        self.assertEqual(
            Curtida.objects.filter(perfil_destino_id=p_a_id).count(), 0,
            'Curtidas de destino para A devem ser removidas')
        self.assertEqual(
            Match.objects.filter(id=self.match.id).count(), 0,
            'Match de A deve ser removido')
        self.assertEqual(
            self.Mensagem.objects.filter(match_id=self.match.id).count(), 0,
            'Mensagens do match devem ser removidas')

    def test_regra_logs_ficam_com_usuario_nulo_apos_exclusao(self):
        """LogOperacao de A fica com usuario=NULL após excluir a conta."""
        from logs.models import LogOperacao
        log = LogOperacao.objects.filter(usuario=self.u_a).first()
        self.assertIsNotNone(log)
        self.u_a.delete()
        log.refresh_from_db()
        self.assertIsNone(log.usuario)


class RegraDenunciaProcedenteNaoSuspende(TestCase):
    """Regra: resolver denúncia como 'resolvida' NÃO suspende automaticamente."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='adm_dns', email='adm_dns@test.com', password='Admin@1234',
            tipo='administrador')
        self.u_a = User.objects.create_user(
            username='dns_a', email='dns_a@test.com', password='Senha@1234',
            tipo='buscando_vaga')
        self.u_b = User.objects.create_user(
            username='dns_b', email='dns_b@test.com', password='Senha@1234',
            tipo='oferecendo_vaga')
        self.p_a = Perfil.objects.create(usuario=self.u_a, **_PERFIL_BASE)
        self.p_b = Perfil.objects.create(usuario=self.u_b, **_PERFIL_BASE)

    def test_regra_resolucao_procedente_nao_suspende_automaticamente(self):
        """Resolver uma denúncia como 'resolvida' não muda is_active do denunciado."""
        from moderacao.servicos import criar_denuncia, resolver_denuncia

        denuncia = criar_denuncia(
            denunciante=self.u_a,
            denunciado_id=self.u_b.id,
            motivo='spam',
        )
        resolver_denuncia(denuncia, self.admin, 'resolvida', 'Procedente.')
        self.u_b.refresh_from_db()
        self.assertTrue(self.u_b.is_active,
                        'Usuário NÃO deve ser suspenso só por resolver a denúncia')

    def test_regra_resolucao_improcedente_nao_suspende(self):
        """Resolver uma denúncia como 'descartada' não muda is_active do denunciado."""
        from moderacao.servicos import criar_denuncia, resolver_denuncia

        denuncia = criar_denuncia(
            denunciante=self.u_a,
            denunciado_id=self.u_b.id,
            motivo='falso',
        )
        resolver_denuncia(denuncia, self.admin, 'descartada', 'Improcedente.')
        self.u_b.refresh_from_db()
        self.assertTrue(self.u_b.is_active,
                        'Usuário NÃO deve ser suspenso quando denúncia é descartada')


class RegraTaxaMatchDashboard(TestCase):
    """Regra: taxa_match = matches×2 ÷ curtidas, nunca ultrapassa 100%."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='adm_tx', email='adm_tx@test.com', password='Admin@1234',
            tipo='administrador')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _criar_par(self, suffix, curtir_mutuo=True):
        ua = User.objects.create_user(
            username=f'tx_a_{suffix}', email=f'tx_a_{suffix}@test.com',
            password='Senha@1234', tipo='buscando_vaga')
        ub = User.objects.create_user(
            username=f'tx_b_{suffix}', email=f'tx_b_{suffix}@test.com',
            password='Senha@1234', tipo='oferecendo_vaga')
        pa = Perfil.objects.create(usuario=ua, **_PERFIL_BASE)
        pb = Perfil.objects.create(usuario=ub, **_PERFIL_BASE)
        Curtida.objects.create(perfil_origem=pa, perfil_destino=pb, tipo='curtir')
        if curtir_mutuo:
            Curtida.objects.create(perfil_origem=pb, perfil_destino=pa, tipo='curtir')
            pid_a = min(pa.id, pb.id)
            pid_b = max(pa.id, pb.id)
            Match.objects.create(perfil_a_id=pid_a, perfil_b_id=pid_b, score=0.6)
        return pa, pb

    def test_regra_taxa_match_formula(self):
        """taxa_match = matches×2 ÷ curtidas; nunca >100%."""
        # 1 par com match mútuo → 2 curtidas, 1 match → taxa = 100%
        self._criar_par('1', curtir_mutuo=True)
        res = self.client.get('/api/admin/dashboard/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        taxa = res.data['kpis']['taxa_match']
        self.assertLessEqual(taxa, 100.0, 'taxa_match nunca deve passar de 100%')
        self.assertGreaterEqual(taxa, 0.0)

    def test_regra_taxa_match_nao_ultrapassa_100(self):
        """Mesmo com mais matches que curtidas (dados inconsistentes), taxa <= 100%."""
        # Cria match diretamente sem curtidas para forcar matches*2 > curtidas
        ua = User.objects.create_user(
            username='tx_edge_a', email='tx_edge_a@test.com',
            password='Senha@1234', tipo='buscando_vaga')
        ub = User.objects.create_user(
            username='tx_edge_b', email='tx_edge_b@test.com',
            password='Senha@1234', tipo='oferecendo_vaga')
        pa = Perfil.objects.create(usuario=ua, **_PERFIL_BASE)
        pb = Perfil.objects.create(usuario=ub, **_PERFIL_BASE)
        pid_a = min(pa.id, pb.id)
        pid_b = max(pa.id, pb.id)
        Match.objects.create(perfil_a_id=pid_a, perfil_b_id=pid_b, score=0.5)
        # 1 match, 0 curtidas -> formula retornaria divisao por zero ou >100%; deve ser capped
        res = self.client.get('/api/admin/dashboard/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        taxa = res.data['kpis']['taxa_match']
        self.assertLessEqual(taxa, 100.0, 'taxa_match com 0 curtidas deve ser <= 100%')


class RegraCompatibilidadeRegiao(TestCase):
    """Regra: relatório compatibilidade-por-região: 'Perfis com match (%)' ≤ 100%."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='adm_reg', email='adm_reg@test.com', password='Admin@1234',
            tipo='administrador')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        # Cria par com match na mesma região
        ua = User.objects.create_user(
            username='reg_a', email='reg_a@test.com',
            password='Senha@1234', tipo='buscando_vaga')
        ub = User.objects.create_user(
            username='reg_b', email='reg_b@test.com',
            password='Senha@1234', tipo='oferecendo_vaga')
        pa = Perfil.objects.create(usuario=ua, **{**_PERFIL_BASE, 'regiao': 'Recife'})
        pb = Perfil.objects.create(usuario=ub, **{**_PERFIL_BASE, 'regiao': 'Recife'})
        pid_a = min(pa.id, pb.id)
        pid_b = max(pa.id, pb.id)
        Match.objects.create(perfil_a_id=pid_a, perfil_b_id=pid_b, score=0.75)

    def test_regra_compatibilidade_regiao_percentual_nao_ultrapassa_100(self):
        """Todos os percentuais de perfis_com_match_pct devem ser <= 100%."""
        res = self.client.get('/api/admin/relatorios/compatibilidade-regiao/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        # linhas: [regiao, n_perfis, n_compats, score_pct, n_matches, perfis_com_match_pct]
        for linha in res.data['linhas']:
            pct = linha[5]
            self.assertLessEqual(
                pct, 100.0,
                f'perfis_com_match_pct={pct} ultrapassa 100% na regiao {linha[0]}',
            )
            self.assertGreaterEqual(pct, 0.0)
