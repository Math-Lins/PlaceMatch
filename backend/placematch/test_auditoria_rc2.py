"""Auditoria da RC, segunda rodada (docs/auditoria-rc.md): testes de regressão.

AUD-09 limite de login · AUD-15 logout/blacklist · AUD-10 denúncia duplicada · AUD-11 DEBUG padrão ·
AUD-12 período máximo · AUD-16 fim do dia · AUD-18 entidade_id 64 bits · AUD-19 match apagado no envio.
"""
import os
import subprocess
import sys
from datetime import datetime
from unittest import mock
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.db import IntegrityError, models
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from logs.models import LogOperacao
from logs.servicos import registrar
from matches.models import Match
from moderacao.models import Denuncia
from placematch.limites import MENSAGEM_LIMITE
from placematch.testutils_sprint9 import SENHA, BaseSprint9, corpo_texto, criar_usuario

LOGIN = '/api/auth/login/'


def _tentar(cliente, email, senha='errada', ip='10.0.0.1', **extra):
    return cliente.post(LOGIN, {'email': email, 'password': senha}, format='json', REMOTE_ADDR=ip, **extra)


class AUD09LimiteDeTentativasDeLoginTest(BaseSprint9):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.addCleanup(cache.clear)
        self.client = APIClient()

    @override_settings(LOGIN_LIMITE_IP='5/min', LOGIN_LIMITE_EMAIL='off')
    def test_sexta_tentativa_falha_do_mesmo_ip_responde_429(self):
        for i in range(5):
            self.assertEqual(_tentar(self.client, f'x{i}@t.com').status_code, 401)
        res = _tentar(self.client, 'outro@t.com')
        self.assertEqual(res.status_code, 429, corpo_texto(res))
        self.assertEqual(res.json()['detail'], MENSAGEM_LIMITE)
        self.assertEqual(res.json()['detail'], 'Muitas tentativas. Aguarde alguns minutos e tente de novo.')
        self.assertGreater(int(res['Retry-After']), 0)

    @override_settings(LOGIN_LIMITE_IP='5/min', LOGIN_LIMITE_EMAIL='off')
    def test_outro_ip_nao_e_afetado(self):
        for i in range(5):
            _tentar(self.client, f'x{i}@t.com', ip='10.0.0.1')
        self.assertEqual(_tentar(self.client, 'buscando@t.com', senha=SENHA, ip='10.0.0.2').status_code, 200)

    @override_settings(LOGIN_LIMITE_IP='2/min', LOGIN_LIMITE_EMAIL='off', PROXIES_CONFIAVEIS=0)
    def test_x_forwarded_for_forjado_nao_escapa_do_limite(self):
        for i in range(2):
            _tentar(self.client, 'a@t.com', HTTP_X_FORWARDED_FOR=f'203.0.113.{i}')
        res = _tentar(self.client, 'a@t.com', HTTP_X_FORWARDED_FOR='203.0.113.99')
        self.assertEqual(res.status_code, 429)

    @override_settings(LOGIN_LIMITE_IP='1/min', LOGIN_LIMITE_EMAIL='off', PROXIES_CONFIAVEIS=1)
    def test_com_proxy_confiavel_usa_o_ip_informado_pelo_proxy(self):
        _tentar(self.client, 'a@t.com', HTTP_X_FORWARDED_FOR='198.51.100.1')
        self.assertEqual(_tentar(self.client, 'a@t.com', HTTP_X_FORWARDED_FOR='198.51.100.2').status_code, 401)
        self.assertEqual(_tentar(self.client, 'a@t.com', HTTP_X_FORWARDED_FOR='198.51.100.1').status_code, 429)

    @override_settings(LOGIN_LIMITE_IP='off', LOGIN_LIMITE_EMAIL='3/hour')
    def test_limite_por_email_vale_de_qualquer_ip_e_ignora_maiusculas(self):
        for i, email in enumerate(['buscando@t.com', 'BUSCANDO@T.COM', ' Buscando@t.com ']):
            self.assertEqual(_tentar(self.client, email, ip=f'10.0.1.{i}').status_code, 401)
        res = _tentar(self.client, 'buscando@t.com', senha=SENHA, ip='10.0.9.9')
        self.assertEqual(res.status_code, 429, 'mesmo com a senha certa, o e-mail está bloqueado')

    @override_settings(LOGIN_LIMITE_IP='off', LOGIN_LIMITE_EMAIL='3/hour')
    def test_email_inexistente_tambem_conta_e_nao_bloqueia_outros_emails(self):
        for _ in range(3):
            _tentar(self.client, 'fantasma@t.com')
        self.assertEqual(_tentar(self.client, 'fantasma@t.com').status_code, 429)
        self.assertEqual(_tentar(self.client, 'buscando@t.com', senha=SENHA).status_code, 200)

    @override_settings(LOGIN_LIMITE_IP='off', LOGIN_LIMITE_EMAIL='3/hour')
    def test_login_correto_zera_o_contador_do_email(self):
        for _ in range(2):
            _tentar(self.client, 'buscando@t.com')
        self.assertEqual(_tentar(self.client, 'buscando@t.com', senha=SENHA).status_code, 200)
        for _ in range(2):
            self.assertEqual(_tentar(self.client, 'buscando@t.com').status_code, 401)
        self.assertEqual(_tentar(self.client, 'buscando@t.com', senha=SENHA).status_code, 200)

    @override_settings(LOGIN_LIMITE_IP='3/min', LOGIN_LIMITE_EMAIL='off')
    def test_logins_corretos_nao_consomem_o_limite(self):
        for _ in range(10):
            self.assertEqual(_tentar(self.client, 'buscando@t.com', senha=SENHA).status_code, 200)

    @override_settings(LOGIN_LIMITE_IP='off', LOGIN_LIMITE_EMAIL='')
    def test_desligado_nao_bloqueia(self):
        for _ in range(30):
            self.assertEqual(_tentar(self.client, 'x@t.com').status_code, 401)

    @override_settings(LOGIN_LIMITE_IP='2/min', LOGIN_LIMITE_EMAIL='off')
    def test_conta_suspensa_tambem_conta_como_falha(self):
        self.ub.is_active = False
        self.ub.save()
        for _ in range(2):
            self.assertEqual(_tentar(self.client, 'buscando@t.com', senha=SENHA).status_code, 401)
        self.assertEqual(_tentar(self.client, 'buscando@t.com', senha=SENHA).status_code, 429)


class AUD15LogoutEBlacklistTest(BaseSprint9):
    def _login(self):
        r = self.client.post(LOGIN, {'email': 'buscando@t.com', 'password': SENHA}, format='json')
        self.assertEqual(r.status_code, 200)
        return r.json()

    def _refresh(self, token):
        return self.client.post('/api/auth/login/refresh/', {'refresh': token}, format='json')

    def test_refresh_depois_do_logout_responde_401(self):
        tk = self._login()
        res = self.client.post('/api/auth/logout/', {'refresh': tk['refresh']}, format='json')
        self.assertEqual(res.status_code, 204, corpo_texto(res))
        self.assertEqual(self._refresh(tk['refresh']).status_code, 401)

    def test_logout_repetido_ou_token_invalido_responde_401(self):
        tk = self._login()
        self.client.post('/api/auth/logout/', {'refresh': tk['refresh']}, format='json')
        for token in (tk['refresh'], 'lixo.lixo.lixo'):
            res = self.client.post('/api/auth/logout/', {'refresh': token}, format='json')
            self.assertEqual(res.status_code, 401, corpo_texto(res))
            self.assertEqual(res.json()['detail'], 'O token é inválido ou já foi encerrado.')

    def test_logout_sem_refresh_ou_com_tipo_errado_responde_400(self):
        for corpo in ({}, {'refresh': ''}, {'refresh': 123}, {'refresh': None}, ['x']):
            res = self.client.post('/api/auth/logout/', corpo, format='json')
            self.assertEqual(res.status_code, 400, f'{corpo}: {corpo_texto(res)}')

    def test_refresh_rotacionado_antigo_deixa_de_valer(self):
        tk = self._login()
        novo = self._refresh(tk['refresh'])
        self.assertEqual(novo.status_code, 200)
        self.assertNotEqual(novo.json()['refresh'], tk['refresh'])
        self.assertEqual(self._refresh(tk['refresh']).status_code, 401, 'o refresh antigo foi bloqueado na troca')
        self.assertEqual(self._refresh(novo.json()['refresh']).status_code, 200, 'o novo continua valendo')

    def test_refresh_de_conta_suspensa_responde_401(self):
        tk = self._login()
        self.ub.is_active = False
        self.ub.save()
        self.assertEqual(self._refresh(tk['refresh']).status_code, 401)

    def test_refresh_do_proximo_login_nao_e_afetado_pelo_logout_anterior(self):
        antigo = self._login()
        self.client.post('/api/auth/logout/', {'refresh': antigo['refresh']}, format='json')
        novo = self._login()
        self.assertEqual(self._refresh(novo['refresh']).status_code, 200)

    def test_logout_nao_exige_access_e_aceita_refresh_gerado_direto(self):
        refresh = str(RefreshToken.for_user(self.ub))
        res = APIClient().post('/api/auth/logout/', {'refresh': refresh}, format='json')
        self.assertEqual(res.status_code, 204)


class AUD10DenunciaDuplicadaTest(BaseSprint9):
    URL = '/api/moderacao/denuncias/'

    def _denunciar(self, usuario, alvo=None):
        return self.como(usuario).post(
            self.URL, {'denunciado': (alvo or self.uo).id, 'motivo': 'spam'}, format='json')

    def test_segunda_denuncia_pendente_contra_o_mesmo_usuario_e_recusada(self):
        self.assertEqual(self._denunciar(self.ub).status_code, 201)
        res = self._denunciar(self.ub)
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertEqual(res.json()['detail'], 'Você já tem uma denúncia pendente contra este usuário. Aguarde a análise da equipe.')
        self.assertEqual(Denuncia.objects.count(), 1)

    def test_depois_de_analisada_pode_denunciar_de_novo(self):
        self._denunciar(self.ub)
        Denuncia.objects.update(status='descartada')
        self.assertEqual(self._denunciar(self.ub).status_code, 201)

    def test_outro_denunciante_ou_outro_alvo_nao_e_afetado(self):
        outro = criar_usuario('outro@t.com', 'buscando_vaga')
        terceiro = criar_usuario('terceiro@t.com', 'oferecendo_vaga')
        self._denunciar(self.ub)
        self.assertEqual(self._denunciar(outro).status_code, 201)
        self.assertEqual(self._denunciar(self.ub, terceiro).status_code, 201)


class AUD11DebugPadraoTest(BaseSprint9):
    """Sem a variável DEBUG a aplicação sobe com DEBUG desligado (e então exige SECRET_KEY de produção)."""

    def _importar_settings(self, **env_extra):
        codigo = (
            "import dotenv; dotenv.load_dotenv = lambda *a, **k: None\n"  # ignora o .env do desenvolvedor
            "import os\n"
            "os.environ.pop('DEBUG', None); os.environ.pop('SECRET_KEY', None)\n"
            + ''.join(f"os.environ[{k!r}] = {v!r}\n" for k, v in env_extra.items()) +
            "import placematch.settings as s\n"
            "print('DEBUG=' + str(s.DEBUG))\n"
        )
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return subprocess.run([sys.executable, '-c', codigo], cwd=base, capture_output=True, text=True,
                              env={**os.environ, 'DJANGO_SETTINGS_MODULE': 'placematch.settings'})

    def test_sem_a_variavel_debug_fica_desligado_e_exige_secret_key(self):
        r = self._importar_settings()
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn('SECRET_KEY', r.stderr)

    def test_sem_a_variavel_debug_e_com_chave_forte_sobe_com_debug_false(self):
        r = self._importar_settings(SECRET_KEY='x' * 40)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('DEBUG=False', r.stdout)

    def test_debug_true_explicito_continua_funcionando(self):
        r = self._importar_settings(DEBUG='True')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('DEBUG=True', r.stdout)


class AUD12PeriodoMaximoTest(BaseSprint9):
    ROTAS = [
        '/api/admin/dashboard/', '/api/admin/logs/', '/api/admin/logs/exportar/', '/api/admin/usuarios/',
        '/api/admin/usuarios/exportar/', '/api/admin/moderacao/denuncias/',
        '/api/admin/relatorios/matches/', '/api/admin/relatorios/atividade/',
        '/api/admin/relatorios/usuarios/', '/api/admin/relatorios/denuncias/',
    ]

    def _get(self, rota, **params):
        return self.como(self.adm).get(rota, params)

    def test_periodo_de_mais_de_366_dias_responde_400_em_todas_as_rotas(self):
        for rota in self.ROTAS:
            res = self._get(rota, data_inicio='2025-01-01', data_fim='2026-01-02')  # 367 dias
            self.assertEqual(res.status_code, 400, f'{rota}: {corpo_texto(res)}')
            self.assertIn('366 dias', res.json()['detail'])

    def test_periodo_de_exatamente_366_dias_e_aceito(self):
        for rota in self.ROTAS:
            res = self._get(rota, data_inicio='2025-01-01', data_fim='2026-01-01')  # 366 dias
            self.assertEqual(res.status_code, 200, f'{rota}: {corpo_texto(res)}')

    def test_data_anterior_a_2000_responde_400(self):
        for rota in self.ROTAS:
            for param in ('data_inicio', 'data_fim'):
                res = self._get(rota, **{param: '1999-12-31'})
                self.assertEqual(res.status_code, 400, f'{rota} {param}: {corpo_texto(res)}')
                self.assertIn('01/01/2000', res.json()['detail'])

    def test_data_minima_2000_01_01_e_aceita(self):
        res = self._get('/api/admin/logs/', data_inicio='2000-01-01', data_fim='2000-01-31')
        self.assertEqual(res.status_code, 200)

    def test_dashboard_considera_o_periodo_padrao_quando_so_uma_data_e_enviada(self):
        res = self._get('/api/admin/dashboard/', data_inicio='2000-01-01')
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        res = self._get('/api/admin/dashboard/', data_fim='9999-12-31')
        self.assertEqual(res.status_code, 400, corpo_texto(res))

    def test_dashboard_sem_parametros_continua_ok(self):
        res = self._get('/api/admin/dashboard/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()['series']['matches_por_dia']), 30)

    def test_mensagens_antigas_continuam(self):
        res = self._get('/api/admin/logs/', data_inicio='2026-02-01', data_fim='2026-01-01')
        self.assertEqual(res.json()['detail'], 'data_inicio não pode ser maior que data_fim.')


class AUD16FimDoDiaInclusoTest(BaseSprint9):
    def test_registro_no_ultimo_microssegundo_do_dia_entra_no_filtro(self):
        registrar('LOGIN', usuario=self.ub)
        instante = datetime(2026, 3, 10, 23, 59, 59, 999999, tzinfo=ZoneInfo('America/Sao_Paulo'))
        LogOperacao.objects.update(data_hora=instante)
        res = self.como(self.adm).get('/api/admin/logs/', {'data_inicio': '2026-03-10', 'data_fim': '2026-03-10'})
        self.assertEqual(res.json()['count'], 1)
        res = self.como(self.adm).get('/api/admin/logs/', {'data_inicio': '2026-03-11', 'data_fim': '2026-03-11'})
        self.assertEqual(res.json()['count'], 0)

    def test_registro_as_23_59_59_e_meio_entra_no_relatorio_de_denuncias(self):
        Denuncia.objects.create(denunciante=self.ub, denunciado=self.uo, motivo='spam')
        instante = datetime(2026, 3, 10, 23, 59, 59, 500000, tzinfo=ZoneInfo('America/Sao_Paulo'))
        Denuncia.objects.update(criada_em=instante)
        res = self.como(self.adm).get('/api/admin/relatorios/denuncias/', {'data_inicio': '2026-03-10', 'data_fim': '2026-03-10'})
        self.assertEqual(res.json()['totais']['total'], 1)


class AUD18EntidadeIdDe64BitsTest(BaseSprint9):
    def test_campo_e_bigint_e_guarda_ids_acima_de_2_bilhoes(self):
        campo = LogOperacao._meta.get_field('entidade_id')
        self.assertIsInstance(campo, models.BigIntegerField)
        self.assertNotIsInstance(campo, models.PositiveIntegerField)
        registrar('CURTIDA', usuario=self.ub, entidade='perfil', entidade_id=3_000_000_000)
        self.assertEqual(LogOperacao.objects.get().entidade_id, 3_000_000_000)


class AUD19MatchApagadoNoEnvioTest(BaseSprint9):
    def test_match_que_some_entre_a_checagem_e_a_gravacao_responde_404(self):
        a, b = sorted([self.pb.id, self.po.id])
        match = Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.5)
        self.client.raise_request_exception = False
        with mock.patch('chat.views.Mensagem.objects.create', side_effect=IntegrityError('FOREIGN KEY constraint failed')):
            res = self.como(self.ub).post(f'/api/matches/{match.id}/mensagens/', {'conteudo': 'oi'}, format='json')
        self.assertEqual(res.status_code, 404, corpo_texto(res))
        self.assertEqual(res.json()['detail'], 'Match não encontrado.')

    def test_envio_normal_continua_201(self):
        a, b = sorted([self.pb.id, self.po.id])
        match = Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.5)
        res = self.como(self.ub).post(f'/api/matches/{match.id}/mensagens/', {'conteudo': 'oi'}, format='json')
        self.assertEqual(res.status_code, 201)
