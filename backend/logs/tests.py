from unittest.mock import patch
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from usuarios.models import Usuario
from perfis.models import Perfil
from matches.models import Match
from chat.models import Mensagem
from .models import LogOperacao


def criar_usuario(email='u@test.com', senha='senha1234', tipo='buscando_vaga'):
    u = Usuario.objects.create_user(username=email, email=email, password=senha, tipo=tipo)
    return u


def criar_perfil(usuario, **kwargs):
    defaults = dict(
        nome='Test', idade=25, regiao='Recife',
        orcamento_min=500, orcamento_max=1500,
    )
    defaults.update(kwargs)
    return Perfil.objects.create(usuario=usuario, **defaults)


class LogCadastroTest(APITestCase):
    def test_cadastro_gera_log(self):
        url = reverse('auth-registrar')
        self.client.post(url, {
            'username': 'novo', 'email': 'novo@test.com',
            'password': 'senhaSegura1', 'tipo': 'buscando_vaga',
        })
        log = LogOperacao.objects.filter(acao='CADASTRO').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.entidade, 'usuario')


class LogLoginTest(APITestCase):
    def setUp(self):
        self.usuario = criar_usuario('login@test.com', 'senhaSegura1')

    def test_login_sucesso_gera_log(self):
        url = reverse('auth-login')
        self.client.post(url, {'email': 'login@test.com', 'password': 'senhaSegura1'})
        log = LogOperacao.objects.filter(acao='LOGIN').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.usuario, self.usuario)

    def test_login_falha_gera_log_sem_email_senha(self):
        url = reverse('auth-login')
        self.client.post(url, {'email': 'login@test.com', 'password': 'errada'})
        log = LogOperacao.objects.filter(acao='LOGIN_FALHA').first()
        self.assertIsNotNone(log)
        self.assertIsNone(log.usuario)
        # não deve conter e-mail nem senha nos detalhes
        detalhes_str = str(log.detalhes)
        self.assertNotIn('login@test.com', detalhes_str)
        self.assertNotIn('errada', detalhes_str)
        self.assertNotIn('senhaSegura', detalhes_str)


class LogPerfilTest(APITestCase):
    def setUp(self):
        self.usuario = criar_usuario('perfil@test.com', 'senhaSegura1')
        self.client.force_authenticate(self.usuario)

    def test_criar_perfil_gera_log(self):
        url = reverse('perfil-list')
        self.client.post(url, {
            'nome': 'Test', 'idade': 25, 'regiao': 'Recife',
            'orcamento_min': 500, 'orcamento_max': 1500,
        })
        log = LogOperacao.objects.filter(acao='PERFIL_CRIADO').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.entidade, 'perfil')

    def test_editar_perfil_gera_log_com_campos(self):
        perfil = criar_perfil(self.usuario)
        url = reverse('perfil-detail', args=[perfil.id])
        self.client.patch(url, {'nome': 'Novo Nome'})
        log = LogOperacao.objects.filter(acao='PERFIL_EDITADO').first()
        self.assertIsNotNone(log)
        self.assertIn('nome', log.detalhes.get('campos', []))

    def test_excluir_perfil_gera_log(self):
        perfil = criar_perfil(self.usuario)
        perfil_id = perfil.id
        url = reverse('perfil-detail', args=[perfil.id])
        self.client.delete(url)
        log = LogOperacao.objects.filter(acao='PERFIL_EXCLUIDO').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.entidade_id, perfil_id)


class LogCurtidaTest(APITestCase):
    def setUp(self):
        self.u1 = criar_usuario('u1@test.com', 'senhaSegura1', tipo='buscando_vaga')
        self.u2 = criar_usuario('u2@test.com', 'senhaSegura1', tipo='oferecendo_vaga')
        self.p1 = criar_perfil(self.u1)
        self.p2 = criar_perfil(self.u2)
        self.client.force_authenticate(self.u1)

    def test_curtida_gera_log(self):
        url = reverse('curtidas')
        self.client.post(url, {'perfil_destino': self.p2.id, 'tipo': 'curtir'})
        log = LogOperacao.objects.filter(acao='CURTIDA').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.entidade_id, self.p2.id)

    def test_recusa_gera_log(self):
        url = reverse('curtidas')
        self.client.post(url, {'perfil_destino': self.p2.id, 'tipo': 'recusar'})
        log = LogOperacao.objects.filter(acao='RECUSA').first()
        self.assertIsNotNone(log)

    def test_match_gera_log_com_score(self):
        # u2 curte u1 primeiro
        self.client.force_authenticate(self.u2)
        url = reverse('curtidas')
        self.client.post(url, {'perfil_destino': self.p1.id, 'tipo': 'curtir'})
        # u1 curte u2 → match
        self.client.force_authenticate(self.u1)
        self.client.post(url, {'perfil_destino': self.p2.id, 'tipo': 'curtir'})
        log = LogOperacao.objects.filter(acao='MATCH_CRIADO').first()
        self.assertIsNotNone(log)
        self.assertIn('match_id', log.detalhes)
        self.assertIn('score', log.detalhes)


class LogMensagemTest(APITestCase):
    def setUp(self):
        self.u1 = criar_usuario('mu1@test.com', 'senhaSegura1', tipo='buscando_vaga')
        self.u2 = criar_usuario('mu2@test.com', 'senhaSegura1', tipo='oferecendo_vaga')
        self.p1 = criar_perfil(self.u1)
        self.p2 = criar_perfil(self.u2)
        pa_id = min(self.p1.id, self.p2.id)
        pb_id = max(self.p1.id, self.p2.id)
        self.match = Match.objects.create(perfil_a_id=pa_id, perfil_b_id=pb_id, score=0.8)
        self.client.force_authenticate(self.u1)

    def test_mensagem_nao_guarda_texto(self):
        url = reverse('mensagens', args=[self.match.id])
        self.client.post(url, {'conteudo': 'Texto secreto da mensagem'})
        log = LogOperacao.objects.filter(acao='MENSAGEM_ENVIADA').first()
        self.assertIsNotNone(log)
        self.assertNotIn('Texto secreto', str(log.detalhes))
        self.assertIn('tamanho', log.detalhes)
        self.assertIn('match_id', log.detalhes)


class LogUsuarioExcluidoTest(APITestCase):
    def test_excluir_usuario_mantem_log_com_usuario_nulo(self):
        usuario = criar_usuario('del@test.com', 'senhaSegura1')
        from logs.servicos import registrar
        registrar('LOGIN', usuario=usuario, entidade='usuario', entidade_id=usuario.id)
        log_id = LogOperacao.objects.filter(usuario=usuario).first().id
        usuario.delete()
        log = LogOperacao.objects.get(id=log_id)
        self.assertIsNone(log.usuario)


class LogAdminListTest(APITestCase):
    def setUp(self):
        self.admin = criar_usuario('adm@test.com', 'senhaSegura1', tipo='administrador')
        self.regular = criar_usuario('reg@test.com', 'senhaSegura1', tipo='buscando_vaga')
        from logs.servicos import registrar
        for i in range(5):
            registrar('LOGIN', usuario=self.admin, entidade='usuario', entidade_id=self.admin.id)
        registrar('CADASTRO', usuario=self.regular, entidade='usuario', entidade_id=self.regular.id)

    def test_anonimo_recebe_401(self):
        url = reverse('logs-list')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_nao_admin_recebe_403(self):
        self.client.force_authenticate(self.regular)
        url = reverse('logs-list')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_lista_logs(self):
        self.client.force_authenticate(self.admin)
        url = reverse('logs-list')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('count', resp.data)
        self.assertIn('results', resp.data)

    def test_paginacao(self):
        self.client.force_authenticate(self.admin)
        url = reverse('logs-list')
        resp = self.client.get(url, {'page': 1, 'page_size': 2})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(resp.data['results']), 2)

    def test_filtro_acao(self):
        self.client.force_authenticate(self.admin)
        url = reverse('logs-list')
        resp = self.client.get(url, {'acao': 'CADASTRO'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for item in resp.data['results']:
            self.assertEqual(item['acao'], 'CADASTRO')

    def test_filtro_usuario(self):
        self.client.force_authenticate(self.admin)
        url = reverse('logs-list')
        resp = self.client.get(url, {'usuario': self.regular.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for item in resp.data['results']:
            self.assertEqual(item['usuario']['id'], self.regular.id)

    def test_filtro_q(self):
        self.client.force_authenticate(self.admin)
        url = reverse('logs-list')
        resp = self.client.get(url, {'q': 'reg@test.com'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreater(resp.data['count'], 0)

    def test_filtro_periodo(self):
        import datetime
        self.client.force_authenticate(self.admin)
        url = reverse('logs-list')
        hoje = datetime.date.today().isoformat()
        resp = self.client.get(url, {'data_inicio': hoje, 'data_fim': hoje})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # todos os logs são de hoje, portanto count deve ser igual ao total
        total_resp = self.client.get(url)
        self.assertEqual(resp.data['count'], total_resp.data['count'])

    def test_resultado_tem_campos_esperados(self):
        self.client.force_authenticate(self.admin)
        url = reverse('logs-list')
        resp = self.client.get(url)
        item = resp.data['results'][0]
        for campo in ('id', 'data_hora', 'usuario', 'acao', 'acao_label',
                      'entidade', 'entidade_id', 'detalhes', 'ip'):
            self.assertIn(campo, item)


class LogExportarTest(APITestCase):
    def setUp(self):
        self.admin = criar_usuario('adm2@test.com', 'senhaSegura1', tipo='administrador')
        self.regular = criar_usuario('reg2@test.com', 'senhaSegura1', tipo='buscando_vaga')
        from logs.servicos import registrar
        registrar('LOGIN', usuario=self.admin, entidade='usuario', entidade_id=self.admin.id)
        registrar('CADASTRO', usuario=self.regular, entidade='usuario', entidade_id=self.regular.id)

    def test_anonimo_recebe_401(self):
        url = reverse('logs-exportar')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_nao_admin_recebe_403(self):
        self.client.force_authenticate(self.regular)
        url = reverse('logs-exportar')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_exporta_csv_com_cabecalho(self):
        self.client.force_authenticate(self.admin)
        url = reverse('logs-exportar')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', resp['Content-Type'])
        content = resp.content.decode('utf-8-sig')
        lines = content.strip().split('\n')
        self.assertGreater(len(lines), 1)
        cabecalho = lines[0]
        self.assertIn('ID', cabecalho)
        self.assertIn('Data/Hora', cabecalho)

    def test_exportar_gera_log_relatorio_exportado(self):
        self.client.force_authenticate(self.admin)
        url = reverse('logs-exportar')
        self.client.get(url)
        log = LogOperacao.objects.filter(acao='RELATORIO_EXPORTADO').first()
        self.assertIsNotNone(log)
        self.assertIn('filtros', log.detalhes)

    def test_exportar_com_filtro_acao(self):
        self.client.force_authenticate(self.admin)
        url = reverse('logs-exportar')
        resp = self.client.get(url, {'acao': 'LOGIN'})
        content = resp.content.decode('utf-8-sig')
        lines = [l for l in content.strip().split('\n') if l]
        # cabeçalho + ao menos 1 linha de dados LOGIN
        self.assertGreater(len(lines), 1)
        # todas as linhas de dados devem ser LOGIN (coluna 6)
        for line in lines[1:]:
            cols = line.split(';')
            self.assertEqual(cols[5].strip(), 'LOGIN')


class LogFalhaGravacaoTest(APITestCase):
    def test_falha_no_log_nao_quebra_cadastro(self):
        url = reverse('auth-registrar')
        with patch('logs.models.LogOperacao.objects.create', side_effect=Exception('DB error')):
            resp = self.client.post(url, {
                'username': 'safe', 'email': 'safe@test.com',
                'password': 'senhaSegura1', 'tipo': 'buscando_vaga',
            })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Usuario.objects.filter(email='safe@test.com').exists())
