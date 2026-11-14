"""Sprint 9 — testes funcionais (CT-F) e de validação (CT-V) de usuários/autenticação."""
from datetime import timedelta

from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from placematch.testutils_sprint9 import (
    SENHA, corpo_texto, criar_usuario, reg, tem_ingles,
)

REGISTRAR = '/api/auth/registrar/'
LOGIN = '/api/auth/login/'
REFRESH = '/api/auth/login/refresh/'
ME = '/api/auth/me/'

OK = dict(username='novo', email='novo@t.com', password=SENHA, tipo='buscando_vaga')


class FuncionaisAuthTest(APITestCase):
    def test_ctf01_cadastro_201(self):
        res = self.client.post(REGISTRAR, OK, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertNotIn('password', res.json())

    def test_ctf02_login_200_retorna_tokens(self):
        criar_usuario('a@t.com')
        res = self.client.post(LOGIN, {'email': 'a@t.com', 'password': SENHA}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.json())
        self.assertIn('refresh', res.json())

    def test_ctf03_refresh_token_200(self):
        u = criar_usuario('a@t.com')
        ref = str(RefreshToken.for_user(u))
        res = self.client.post(REFRESH, {'refresh': ref}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.json())

    def test_ctf04_me_retorna_usuario_logado(self):
        u = criar_usuario('a@t.com')
        c = APIClient()
        c.force_authenticate(user=u)
        res = c.get(ME)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['email'], 'a@t.com')
        self.assertNotIn('password', res.json())


class ValidacaoCadastroTest(APITestCase):
    def _post(self, ct, **mudancas):
        dados = {**OK, **mudancas}
        for k in [k for k, v in dados.items() if v is ...]:
            del dados[k]
        res = self.client.post(REGISTRAR, dados, format='json')
        reg(ct, res)
        return res

    def _espera_400_campo(self, res, campo):
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertIn(campo, res.json(), corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv01_email_vazio(self):
        self._espera_400_campo(self._post('CT-V01', email=''), 'email')

    def test_ctv02_email_formato_invalido(self):
        self._espera_400_campo(self._post('CT-V02', email='isso-nao-e-email'), 'email')

    def test_ctv03_email_duplicado(self):
        criar_usuario('novo@t.com')
        self._espera_400_campo(self._post('CT-V03'), 'email')

    def test_ctv04_email_duplicado_com_maiusculas(self):
        criar_usuario('novo@t.com')
        self._espera_400_campo(self._post('CT-V04', email='NOVO@T.COM'), 'email')

    def test_ctv05_senha_curta(self):
        self._espera_400_campo(self._post('CT-V05', password='Ab1!'), 'password')

    def test_ctv06_senha_vazia(self):
        self._espera_400_campo(self._post('CT-V06', password=''), 'password')

    def test_ctv07_tipo_invalido(self):
        self._espera_400_campo(self._post('CT-V07', tipo='dono'), 'tipo')

    def test_ctv08_tipo_administrador_rejeitado(self):
        self._espera_400_campo(self._post('CT-V08', tipo='administrador'), 'tipo')

    def test_ctv09_campos_ausentes(self):
        res = self.client.post(REGISTRAR, {}, format='json')
        reg('CT-V09', res)
        self.assertEqual(res.status_code, 400)
        for campo in ('email', 'password', 'tipo', 'username'):
            self.assertIn(campo, res.json(), corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv10_username_ausente(self):
        self._espera_400_campo(self._post('CT-V10', username=...), 'username')

    def test_ctv11_corpo_nao_objeto(self):
        res = self.client.post(REGISTRAR, [1, 2], format='json')
        reg('CT-V11', res)
        self.assertEqual(res.status_code, 400)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv12_senha_so_numeros(self):
        self._espera_400_campo(self._post('CT-V12', password='123456789'), 'password')


class ValidacaoLoginTest(APITestCase):
    def setUp(self):
        self.u = criar_usuario('a@t.com')

    def _login(self, ct, dados):
        res = self.client.post(LOGIN, dados, format='json')
        reg(ct, res)
        return res
    def test_ctv13_login_campos_vazios(self):
        """Esperado: 400 indicando campos obrigatórios (não mensagem genérica de credencial)."""
        res = self._login('CT-V13', {})
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv14_login_senha_errada(self):
        res = self._login('CT-V14', {'email': 'a@t.com', 'password': 'errada123'})
        self.assertEqual(res.status_code, 401)
        self.assertIn('incorretos', corpo_texto(res))

    def test_ctv15_login_usuario_inexistente(self):
        res = self._login('CT-V15', {'email': 'x@t.com', 'password': SENHA})
        self.assertEqual(res.status_code, 401)
        self.assertIn('incorretos', corpo_texto(res))

    def test_ctv16_login_conta_suspensa(self):
        self.u.is_active = False
        self.u.save()
        res = self._login('CT-V16', {'email': 'a@t.com', 'password': SENHA})
        self.assertEqual(res.status_code, 401)
        self.assertIn('suspensa', corpo_texto(res))
    def test_ctv17_login_corpo_nao_objeto_nao_gera_500(self):
        res = self._login('CT-V17', ['a@t.com'])
        self.assertLess(res.status_code, 500, corpo_texto(res))
        self.assertIn(res.status_code, (400, 401))
    def test_ctv18_login_email_com_maiusculas(self):
        """E-mail é único sem distinguir caixa; o login deveria seguir a mesma regra."""
        res = self._login('CT-V18', {'email': 'A@T.COM', 'password': SENHA})
        self.assertEqual(res.status_code, 200, corpo_texto(res))
    def test_ctv19_login_email_vazio_senha_ok(self):
        res = self._login('CT-V19', {'email': '', 'password': SENHA})
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertIn('email', res.json(), corpo_texto(res))
    def test_ctv20_login_senha_vazia(self):
        res = self._login('CT-V20', {'email': 'a@t.com', 'password': ''})
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertIn('password', res.json(), corpo_texto(res))


class ValidacaoTokensTest(APITestCase):
    def setUp(self):
        self.u = criar_usuario('a@t.com')

    def _get(self, ct, auth):
        c = APIClient()
        if auth is not None:
            c.credentials(HTTP_AUTHORIZATION=auth)
        res = c.get(ME)
        reg(ct, res)
        return res

    def test_ctv21_token_ausente(self):
        res = self._get('CT-V21', None)
        self.assertEqual(res.status_code, 401)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv22_token_malformado(self):
        res = self._get('CT-V22', 'Bearer abc.def')
        self.assertEqual(res.status_code, 401)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv23_token_expirado(self):
        tk = AccessToken.for_user(self.u)
        tk.set_exp(lifetime=-timedelta(minutes=5))
        res = self._get('CT-V23', f'Bearer {tk}')
        self.assertEqual(res.status_code, 401)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv24_cabecalho_sem_token(self):
        res = self._get('CT-V24', 'Bearer')
        self.assertEqual(res.status_code, 401)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv25_refresh_invalido(self):
        res = self.client.post(REFRESH, {'refresh': 'lixo'}, format='json')
        reg('CT-V25', res)
        self.assertEqual(res.status_code, 401)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv26_refresh_ausente(self):
        res = self.client.post(REFRESH, {}, format='json')
        reg('CT-V26', res)
        self.assertEqual(res.status_code, 400)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv27_token_de_usuario_suspenso(self):
        tk = AccessToken.for_user(self.u)
        self.u.is_active = False
        self.u.save()
        res = self._get('CT-V27', f'Bearer {tk}')
        self.assertEqual(res.status_code, 401)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))


class ValidacaoCadastroComoOFrontEnviaTest(APITestCase):
    """O front manda o campo 'Nome completo' como `username` (App.tsx, RegisterScreen)."""
    def test_ctv131_nome_completo_com_espaco(self):
        res = self.client.post(REGISTRAR, {**OK, 'username': 'Maria Silva'}, format='json')
        reg('CT-V131', res)
        self.assertEqual(res.status_code, 201, corpo_texto(res))
    def test_ctv132_duas_pessoas_com_mesmo_nome_e_emails_diferentes(self):
        r1 = self.client.post(REGISTRAR, {**OK, 'username': 'Joao', 'email': 'j1@t.com'}, format='json')
        r2 = self.client.post(REGISTRAR, {**OK, 'username': 'Joao', 'email': 'j2@t.com'}, format='json')
        reg('CT-V132', r2)
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r2.status_code, 201, corpo_texto(r2))

    def test_ctv133_nome_com_acento(self):
        res = self.client.post(REGISTRAR, {**OK, 'username': 'José'}, format='json')
        reg('CT-V133', res)
        self.assertEqual(res.status_code, 201, corpo_texto(res))
