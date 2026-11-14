"""Sprint 9 — testes de regressão das correções de bugs (BUG-01 a BUG-24, lado backend)."""
import importlib
from io import StringIO

from django.apps import apps
from django.core.management import call_command

from chat.models import Mensagem
from logs.models import LogOperacao
from matches.models import Match
from moderacao.models import Denuncia
from perfis.models import Perfil
from placematch.testutils_sprint9 import (
    PERFIL_OK, SENHA, BaseSprint9, corpo_texto, criar_usuario, tem_ingles,
)
from usuarios.models import Usuario

REGISTRAR = '/api/auth/registrar/'
LOGIN = '/api/auth/login/'


class CorrecaoNomeEUsernameTest(BaseSprint9):
    """BUG-01."""

    def _registrar(self, nome, email):
        return self.client.post(REGISTRAR, dict(
            username=nome, email=email, password=SENHA, tipo='buscando_vaga'), format='json')

    def test_nome_vai_para_first_name_e_username_e_gerado_do_email(self):
        res = self._registrar('  Maria   da Silva  ', 'Maria@Teste.com')
        self.assertEqual(res.status_code, 201, corpo_texto(res))
        u = Usuario.objects.get(email='maria@teste.com')
        self.assertEqual(u.first_name, 'Maria da Silva')
        self.assertEqual(u.username, 'maria@teste.com')
        self.assertEqual(res.json()['username'], 'Maria da Silva')  # contrato com o front

    def test_homonimos_geram_usernames_distintos(self):
        self._registrar('João', 'j1@t.com')
        self._registrar('João', 'j2@t.com')
        self.assertEqual(Usuario.objects.filter(first_name='João').count(), 2)

    def test_email_longo_gera_username_valido(self):
        email = 'a' * 140 + '@exemplo.com'
        self.assertEqual(self._registrar('Ana', email).status_code, 201)
        self.assertLessEqual(len(Usuario.objects.get(first_name='Ana').username), 150)

    def test_nome_curto_ou_vazio_tem_mensagem_do_campo(self):
        res = self._registrar('A', 'a@t.com')
        self.assertEqual(res.status_code, 400)
        self.assertIn('nome', corpo_texto(res).lower())
        res = self._registrar('', 'a@t.com')
        self.assertIn('O nome não pode ficar em branco.', corpo_texto(res))

    def test_me_painel_logs_e_csv_mostram_o_nome(self):
        self._registrar('Maria da Silva', 'maria@t.com')
        u = Usuario.objects.get(email='maria@t.com')
        c = self.como(u)
        self.assertEqual(c.get('/api/auth/me/').json()['username'], 'Maria da Silva')
        self.assertEqual(c.get('/api/auth/me/').json()['nome'], 'Maria da Silva')
        adm = self.como(self.adm)
        lista = adm.get('/api/admin/usuarios/', {'q': 'Maria da'}).json()
        self.assertEqual([r['nome'] for r in lista['results']], ['Maria da Silva'])
        logs = adm.get('/api/admin/logs/', {'usuario': 'Maria'}).json()
        self.assertGreaterEqual(logs['count'], 1)
        self.assertEqual(logs['results'][0]['usuario']['nome'], 'Maria da Silva')
        csv = adm.get('/api/admin/usuarios/exportar/').content.decode('utf-8-sig')
        self.assertIn('Maria da Silva', csv)
        rel = adm.get('/api/admin/relatorios/usuarios/').json()
        self.assertIn('Maria da Silva', [linha[1] for linha in rel['linhas']])

    def test_migracao_de_dados_copia_username_para_first_name(self):
        antigo = Usuario.objects.create_user(
            username='Carlos Lima', email='c@t.com', password=SENHA, tipo='buscando_vaga')
        semente = Usuario.objects.create_user(
            username='ana__seed__', email='s@t.com', password=SENHA, tipo='buscando_vaga')
        mig = importlib.import_module('usuarios.migrations.0003_copiar_username_para_first_name')
        mig.copiar(apps, None)
        for u in (antigo, semente):
            u.refresh_from_db()
        self.assertEqual(antigo.first_name, 'Carlos Lima')
        self.assertEqual(semente.first_name, 'ana')

    def test_criar_admin_continua_funcionando(self):
        from unittest import mock
        env = {'ADMIN_EMAIL': 'novoadmin@placematch.com', 'ADMIN_SENHA': 'Senha@Forte123'}
        with mock.patch.dict('os.environ', env):
            call_command('criar_admin', stdout=StringIO())
            call_command('criar_admin', stdout=StringIO())  # idempotente
        adm = Usuario.objects.get(email='novoadmin@placematch.com')
        self.assertEqual(adm.tipo, 'administrador')
        self.assertTrue(adm.is_staff)
        self.assertEqual(adm.username, 'novoadmin@placematch.com')
        self.assertEqual(adm.nome_exibicao, 'novoadmin@placematch.com')
        r = self.client.post(LOGIN, {'email': 'NovoAdmin@placematch.com', 'password': 'Senha@Forte123'},
                             format='json')
        self.assertEqual(r.status_code, 200, corpo_texto(r))
        # a migração de dados não transforma o e-mail do admin em "nome"
        importlib.import_module('usuarios.migrations.0003_copiar_username_para_first_name').copiar(apps, None)
        adm.refresh_from_db()
        self.assertEqual(adm.first_name, '')


class CorrecaoLoginTest(BaseSprint9):
    """BUG-03, 04, 05."""

    def test_login_ignora_maiusculas_no_email(self):
        res = self.client.post(LOGIN, {'email': 'BUSCANDO@T.COM', 'password': SENHA}, format='json')
        self.assertEqual(res.status_code, 200, corpo_texto(res))

    def test_conta_suspensa_so_quando_senha_confere(self):
        self.ub.is_active = False
        self.ub.save()
        r = self.client.post(LOGIN, {'email': 'BUSCANDO@t.com', 'password': SENHA}, format='json')
        self.assertIn('suspensa', corpo_texto(r))
        r = self.client.post(LOGIN, {'email': 'buscando@t.com', 'password': 'errada123'}, format='json')
        self.assertIn('incorretos', corpo_texto(r))
        self.assertNotIn('suspensa', corpo_texto(r))

    def test_conta_ativa_com_senha_errada_nao_diz_suspensa(self):
        r = self.client.post(LOGIN, {'email': 'BUSCANDO@t.com', 'password': 'errada123'}, format='json')
        self.assertEqual(r.status_code, 401)
        self.assertIn('incorretos', corpo_texto(r))

    def test_corpo_invalido_ou_campos_vazios_dao_400_com_o_campo(self):
        r = self.client.post(LOGIN, {}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json(), {'email': ['Informe o e-mail.'], 'password': ['Informe a senha.']})
        for corpo in ([1], 'texto', 123, None):
            r = self.client.post(LOGIN, corpo, format='json')
            self.assertEqual(r.status_code, 400, corpo)
        r = self.client.post(LOGIN, {'email': 123, 'password': ['x']}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('email', r.json())

    def test_login_falha_registra_log(self):
        self.client.post(LOGIN, {'email': 'buscando@t.com', 'password': 'errada123'}, format='json')
        self.assertTrue(LogOperacao.objects.filter(acao='LOGIN_FALHA').exists())


class CorrecaoPerfilTest(BaseSprint9):
    """BUG-02, 10."""

    def test_segundo_perfil_mensagem_exata(self):
        r = self.como(self.ub).post('/api/perfis/', PERFIL_OK, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json(), {'detail': 'Você já possui um perfil.'})
        self.assertEqual(Perfil.objects.filter(usuario=self.ub).count(), 1)

    def test_admin_nao_cria_perfil_403(self):
        r = self.como(self.adm).post('/api/perfis/', PERFIL_OK, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertIn('administrador', corpo_texto(r))


class CorrecaoDescobertaTest(BaseSprint9):
    """BUG-06, 07, 08."""

    def test_filtros_numericos_invalidos_dao_400(self):
        for campo in ('orcamento_min', 'orcamento_max'):
            for valor in ('NaN', 'nan', 'Infinity', '-Infinity', '-1', '-0.01', '1e30', '999999999999', ''):
                if valor == '':
                    continue
                r = self.como(self.ub).get('/api/descoberta/', {campo: valor})
                self.assertEqual(r.status_code, 400, (campo, valor, corpo_texto(r)))
                self.assertIn(campo, corpo_texto(r))

    def test_filtro_numerico_valido_continua_funcionando(self):
        r = self.como(self.ub).get('/api/descoberta/', {'orcamento_min': '0', 'orcamento_max': '99999999.99'})
        self.assertEqual(r.status_code, 200)

    def test_curtir_perfil_de_usuario_suspenso_404(self):
        self.uo.is_active = False
        self.uo.save()
        r = self.como(self.ub).post(
            '/api/curtidas/', {'perfil_destino': self.po.id, 'tipo': 'curtir'}, format='json')
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json(), {'detail': 'Perfil não encontrado.'})


class CorrecaoChatTest(BaseSprint9):
    """BUG-09, 19."""

    def setUp(self):
        super().setUp()
        a, b = sorted([self.pb.id, self.po.id])
        self.match = Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.8)
        self.url = f'/api/matches/{self.match.id}/mensagens/'

    def test_enviar_com_usuario_suspenso_403_com_mensagem(self):
        self.uo.is_active = False
        self.uo.save()
        r = self.como(self.ub).post(self.url, {'conteudo': 'oi'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertIn('suspensa', r.json()['detail'])
        self.assertEqual(Mensagem.objects.count(), 0)

    def test_conteudo_precisa_ser_texto(self):
        for valor in ({'a': 1}, [1, 2], 123, True):
            r = self.como(self.ub).post(self.url, {'conteudo': valor}, format='json')
            self.assertEqual(r.status_code, 400, valor)
            self.assertIn('texto', r.json()['detail'])
        r = self.como(self.ub).post(self.url, [1], format='json')
        self.assertEqual(r.status_code, 400)

    def test_apos_invalido_400(self):
        for valor in ('abc', '-1', '1.5', '9' * 30):
            r = self.como(self.ub).get(self.url, {'apos': valor})
            self.assertEqual(r.status_code, 400, valor)
            self.assertIn('apos', r.json()['detail'])
        self.assertEqual(self.como(self.ub).get(self.url, {'apos': '0'}).status_code, 200)

    def test_ids_gigantes_na_url_nao_dao_500(self):
        c = self.como(self.ub)
        self.assertEqual(c.get(f'/api/matches/{"9" * 30}/mensagens/').status_code, 404)
        self.assertEqual(c.get(f'/api/perfis/{"9" * 30}/').status_code, 404)
        adm = self.como(self.adm)
        self.assertEqual(adm.patch(
            f'/api/admin/moderacao/denuncias/{"9" * 30}/', {'status': 'resolvida'}, format='json'
        ).status_code, 404)
        self.assertEqual(adm.post(
            f'/api/admin/moderacao/usuarios/{"9" * 30}/suspender/', {}, format='json').status_code, 404)


class CorrecaoModeracaoTest(BaseSprint9):
    """BUG-11 a 15."""

    def _den(self, **kw):
        corpo = {'denunciado': self.uo.id, 'motivo': 'spam', **kw}
        return self.como(self.ub).post('/api/moderacao/denuncias/', corpo, format='json')

    def test_limites_de_500_caracteres(self):
        r = self._den(descricao='d' * 501)
        self.assertEqual(r.status_code, 400)
        self.assertIn('A descrição deve ter no máximo 500 caracteres', r.json()['detail'])
        den = Denuncia.objects.create(denunciante=self.ub, denunciado=self.uo, motivo='spam')
        r = self.como(self.adm).patch(
            f'/api/admin/moderacao/denuncias/{den.id}/',
            {'status': 'resolvida', 'resolucao': 'r' * 501}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('A resolução', r.json()['detail'])
        r = self.como(self.adm).post(
            f'/api/admin/moderacao/usuarios/{self.uo.id}/suspender/',
            {'motivo': 'm' * 501}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('O motivo da suspensão', r.json()['detail'])
        self.uo.refresh_from_db()
        self.assertTrue(self.uo.is_active)

    def test_tipos_errados_dao_400_em_portugues(self):
        for valor in ('abc', [1], {'id': 1}, True, 1.5, -3, 0, 10 ** 30):
            r = self._den(denunciado=valor)
            self.assertEqual(r.status_code, 400, (valor, corpo_texto(r)))
            self.assertFalse(tem_ingles(corpo_texto(r)), corpo_texto(r))
            self.assertIn('denunciado', corpo_texto(r))
        for corpo in ({'descricao': ['x']}, {'descricao': {'a': 1}}, {'motivo': ['spam']}):
            r = self._den(**corpo)
            self.assertEqual(r.status_code, 400, corpo)
        r = self.como(self.ub).post('/api/moderacao/denuncias/', 'texto', format='json')
        self.assertEqual(r.status_code, 400)

    def test_resolver_e_suspender_com_corpo_ou_tipos_invalidos(self):
        den = Denuncia.objects.create(denunciante=self.ub, denunciado=self.uo, motivo='spam')
        adm = self.como(self.adm)
        self.assertEqual(adm.patch(
            f'/api/admin/moderacao/denuncias/{den.id}/', [1], format='json').status_code, 400)
        self.assertEqual(adm.patch(
            f'/api/admin/moderacao/denuncias/{den.id}/',
            {'status': 'resolvida', 'resolucao': [1]}, format='json').status_code, 400)
        self.assertEqual(adm.post(
            f'/api/admin/moderacao/usuarios/{self.uo.id}/suspender/', [1], format='json').status_code, 400)
        self.assertEqual(adm.post(
            f'/api/admin/moderacao/usuarios/{self.uo.id}/suspender/',
            {'motivo': {'a': 1}}, format='json').status_code, 400)

    def test_filtros_da_lista_de_denuncias(self):
        adm = self.como(self.adm)
        for params in ({'status': 'xyz'}, {'denunciado': 'abc'}, {'denunciado': '-1'},
                       {'denunciado': '9' * 30}, {'motivo': 'chato'}):
            r = adm.get('/api/admin/moderacao/denuncias/', params)
            self.assertEqual(r.status_code, 400, (params, corpo_texto(r)))
            self.assertFalse(tem_ingles(corpo_texto(r)))
        self.assertEqual(adm.get('/api/admin/moderacao/denuncias/', {'status': 'pendente'}).status_code, 200)


class CorrecaoFiltrosTest(BaseSprint9):
    """BUG-16, 17, 18."""

    def _get(self, url, params):
        return self.como(self.adm).get(url, params)

    def test_logs_filtros_invalidos_dao_400(self):
        for url in ('/api/admin/logs/', '/api/admin/logs/exportar/'):
            for params in ({'data_inicio': '31/12/2025'}, {'data_fim': '2025-13-45'},
                           {'data_inicio': '2025-12-31', 'data_fim': '2025-01-01'},
                           {'acao': 'NAO_EXISTE'}):
                r = self._get(url, params)
                self.assertEqual(r.status_code, 400, (url, params, r.content[:80]))
                self.assertFalse(tem_ingles(corpo_texto(r)))

    def test_logs_filtro_usuario_por_id_email_e_nome(self):
        self.ub.first_name = 'Beatriz Souza'
        self.ub.save()
        LogOperacao.objects.create(acao='LOGIN', usuario=self.ub)
        LogOperacao.objects.create(acao='LOGIN', usuario=self.uo)
        for valor in (str(self.ub.id), 'buscando@t.com', 'BUSCANDO@T', 'Beatriz', 'souza'):
            r = self._get('/api/admin/logs/', {'usuario': valor})
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()['count'], 1, valor)
        self.assertEqual(self._get('/api/admin/logs/', {'usuario': 'ninguem'}).json()['count'], 0)

    def test_usuarios_e_relatorios_filtros_invalidos(self):
        casos = [
            ('/api/admin/usuarios/', {'ativo': 'talvez'}),
            ('/api/admin/usuarios/', {'tipo': 'rei'}),
            ('/api/admin/usuarios/exportar/', {'ativo': 'talvez'}),
            ('/api/admin/usuarios/exportar/', {'tipo': 'rei'}),
            ('/api/admin/relatorios/usuarios/', {'formato': 'pdf'}),
            ('/api/admin/relatorios/usuarios/', {'tipo': 'rei'}),
            ('/api/admin/dashboard/', {'tipo': 'rei'}),
        ]
        for url, params in casos:
            r = self._get(url, params)
            self.assertEqual(r.status_code, 400, (url, params))
            self.assertFalse(tem_ingles(corpo_texto(r)))

    def test_filtros_validos_continuam_funcionando(self):
        self.assertEqual(self._get('/api/admin/usuarios/', {'ativo': 'true', 'tipo': 'buscando_vaga'}).json()['count'], 1)
        self.assertEqual(self._get('/api/admin/relatorios/usuarios/', {'formato': 'csv'}).status_code, 200)


class CorrecaoMensagensPadraoTest(BaseSprint9):
    """BUG-21: textos padrão sem erros de português."""

    def test_mensagens_padrao_corrigidas(self):
        novo = criar_usuario('novo@t.com', 'buscando_vaga')
        r = self.como(novo).post('/api/perfis/', {**PERFIL_OK, 'nome': '', 'idade': -5,
                                                  'tolerancia_bagunca': 0, 'nivel_ruido': 6}, format='json')
        texto = corpo_texto(r)
        self.assertIn('Este campo não pode ficar em branco.', texto)
        self.assertIn('maior ou igual a', texto)
        for ruim in ('pode não estar', 'Certifque-se', 'tenha mais de 8'):
            self.assertNotIn(ruim, texto)

    def test_senha_curta_diz_no_minimo(self):
        r = self.client.post(REGISTRAR, dict(
            username='Ana', email='a@t.com', password='Ab1!', tipo='buscando_vaga'), format='json')
        self.assertEqual(r.json()['password'], ['A senha deve ter no mínimo 8 caracteres.'])


class CorrecaoChaveJwtTest(BaseSprint9):
    """BUG-24."""

    def test_chave_de_teste_tem_ao_menos_32_bytes(self):
        from django.conf import settings
        self.assertGreaterEqual(len(settings.SECRET_KEY.encode()), 32)

    def test_producao_exige_secret_key_do_ambiente(self):
        import subprocess
        import sys
        import os
        codigo = (
            "import os; os.environ['DEBUG']='False'; os.environ['SECRET_KEY']='curta';"
            "os.environ['DJANGO_SETTINGS_MODULE']='placematch.settings';"
            "import django; django.setup()"
        )
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        r = subprocess.run([sys.executable, '-c', codigo], cwd=base, capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('SECRET_KEY', r.stderr)
