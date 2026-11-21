"""Recuperação de senha por e-mail (v1.0.0-rc2)."""
import json
import re
from datetime import datetime, timedelta
from unittest import mock

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from logs.models import LogOperacao
from placematch.limites import LimiteSenhaPorEmail
from placematch.testutils_sprint9 import SENHA, BaseSprint9, corpo_texto
from usuarios.senha import MENSAGEM_LINK_INVALIDO, MENSAGEM_SOLICITACAO

SOLICITAR = '/api/auth/senha/solicitar/'
REDEFINIR = '/api/auth/senha/redefinir/'
LOGIN = '/api/auth/login/'
NOVA = 'NovaSenha@2026x'


class Base(BaseSprint9):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.addCleanup(cache.clear)
        self.client = APIClient()
        mail.outbox.clear()

    def pedir(self, email, **extra):
        return self.client.post(SOLICITAR, {'email': email}, format='json', **extra)

    def link_do_ultimo_email(self):
        corpo = mail.outbox[-1].body
        achou = re.search(r'uid=([^&\s]+)&token=([^\s]+)', corpo)
        self.assertIsNotNone(achou, corpo)
        return achou.group(1), achou.group(2)

    def redefinir(self, uid, token, nova=NOVA):
        return self.client.post(REDEFINIR, {'uid': uid, 'token': token, 'nova_senha': nova}, format='json')

    def entrar(self, email, senha):
        return APIClient().post(LOGIN, {'email': email, 'password': senha}, format='json')


class SolicitarSenhaTest(Base):
    def test_resposta_identica_para_email_existente_e_inexistente(self):
        a = self.pedir('buscando@t.com')
        b = self.pedir('nao.existe@t.com')
        self.assertEqual(a.status_code, 200, corpo_texto(a))
        self.assertEqual(b.status_code, 200)
        self.assertEqual(a.json(), b.json())
        self.assertEqual(a.json()['detail'], 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.')
        self.assertEqual(a.json()['detail'], MENSAGEM_SOLICITACAO)

    def test_envia_so_para_conta_cadastrada(self):
        self.pedir('buscando@t.com')
        self.pedir('nao.existe@t.com')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['buscando@t.com'])

    def test_email_sem_diferenciar_maiusculas_e_com_espacos(self):
        self.pedir('  BUSCANDO@T.com ')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['buscando@t.com'])

    def test_conta_suspensa_recebe_a_mesma_resposta_mas_nao_recebe_e_mail(self):
        self.ub.is_active = False
        self.ub.save()
        res = self.pedir('buscando@t.com')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['detail'], MENSAGEM_SOLICITACAO)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(LogOperacao.objects.get(acao='SENHA_SOLICITADA').detalhes, {'resultado': 'conta_suspensa'})

    def test_administrador_ativo_pode_recuperar_a_senha(self):
        self.pedir('adm@t.com')
        self.assertEqual(len(mail.outbox), 1)
        uid, token = self.link_do_ultimo_email()
        self.assertEqual(self.redefinir(uid, token).status_code, 200)
        self.assertEqual(self.entrar('adm@t.com', NOVA).status_code, 200)

    def test_corpo_invalido_responde_400(self):
        for corpo in ({}, {'email': ''}, {'email': None}, {'email': 123}, {'email': 'isso-nao-e-email'}):
            res = self.client.post(SOLICITAR, corpo, format='json')
            self.assertEqual(res.status_code, 400, f'{corpo}: {corpo_texto(res)}')
        res = self.client.post(SOLICITAR, ['a@t.com'], format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_nao_exige_login_e_ignora_cabecalho_de_autorizacao_invalido(self):
        res = self.client.post(SOLICITAR, {'email': 'buscando@t.com'}, format='json', HTTP_AUTHORIZATION='Bearer lixo')
        self.assertEqual(res.status_code, 200)

    def test_conteudo_do_email(self):
        self.ub.first_name = '<b>Ana</b>'
        self.ub.save()
        self.pedir('buscando@t.com')
        msg = mail.outbox[0]
        self.assertEqual(msg.subject, 'PlaceMatch: redefinição de senha')
        uid, token = self.link_do_ultimo_email()
        link = f'http://localhost:5173/?screen=redefinir-senha&uid={uid}&token={token}'
        self.assertIn(link, msg.body)
        self.assertIn('vale por 1 hora', msg.body)
        self.assertIn('Se você não fez esse pedido, ignore este e-mail', msg.body)
        html, tipo = msg.alternatives[0]
        self.assertEqual(tipo, 'text/html')
        self.assertIn(f'href="{link}"', html.replace('&amp;', '&'))
        self.assertNotIn('<b>Ana</b>', html, 'o nome do usuário deve ser escapado no HTML')
        self.assertIn('&lt;b&gt;Ana&lt;/b&gt;', html)

    @override_settings(FRONTEND_URL='https://app.exemplo.com/')
    def test_link_usa_frontend_url(self):
        self.pedir('buscando@t.com')
        self.assertIn('https://app.exemplo.com/?screen=redefinir-senha&uid=', mail.outbox[0].body)

    def test_falha_no_envio_nao_vira_500_nem_revela(self):
        with mock.patch('usuarios.senha.EmailMultiAlternatives.send', side_effect=OSError('SMTP fora do ar')):
            res = self.pedir('buscando@t.com')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['detail'], MENSAGEM_SOLICITACAO)
        self.assertEqual(LogOperacao.objects.get(acao='SENHA_SOLICITADA').detalhes, {'resultado': 'falha_no_envio'})


class LimitesDePedidosTest(Base):
    @override_settings(SENHA_LIMITE_EMAIL='3/15min', SENHA_LIMITE_IP='off')
    def test_quarto_pedido_do_mesmo_email_nao_envia_e_responde_igual(self):
        respostas = [self.pedir('buscando@t.com', REMOTE_ADDR=f'10.0.0.{i}') for i in range(5)]
        self.assertEqual({r.status_code for r in respostas}, {200})
        self.assertEqual(len({json.dumps(r.json()) for r in respostas}), 1, 'a resposta não pode mudar acima do limite')
        self.assertEqual(len(mail.outbox), 3)

    @override_settings(SENHA_LIMITE_EMAIL='3/15min', SENHA_LIMITE_IP='off')
    def test_pedidos_de_email_inexistente_tambem_contam_e_outro_email_nao_e_afetado(self):
        for _ in range(5):
            self.assertEqual(self.pedir('fantasma@t.com').status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        self.pedir('buscando@t.com')
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(SENHA_LIMITE_EMAIL='off', SENHA_LIMITE_IP='2/hour')
    def test_limite_por_ip(self):
        for email in ('buscando@t.com', 'oferece@t.com', 'adm@t.com'):
            self.assertEqual(self.pedir(email, REMOTE_ADDR='10.1.1.1').status_code, 200)
        self.assertEqual(len(mail.outbox), 2, 'o 3º pedido do mesmo IP não envia')
        self.pedir('adm@t.com', REMOTE_ADDR='10.1.1.2')
        self.assertEqual(len(mail.outbox), 3, 'outro IP não é afetado')

    @override_settings(SENHA_LIMITE_EMAIL='off', SENHA_LIMITE_IP='1/hour')
    def test_x_forwarded_for_forjado_nao_escapa_do_limite_por_ip(self):
        self.pedir('buscando@t.com', HTTP_X_FORWARDED_FOR='203.0.113.1')
        self.pedir('oferece@t.com', HTTP_X_FORWARDED_FOR='203.0.113.2')
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(SENHA_LIMITE_EMAIL=None, SENHA_LIMITE_IP=None)
    def test_desligado_nao_limita(self):
        for _ in range(8):
            self.pedir('buscando@t.com')
        self.assertEqual(len(mail.outbox), 8)

    def test_taxa_de_15_minutos_e_interpretada(self):
        with override_settings(SENHA_LIMITE_EMAIL='3/15min'):
            trava = LimiteSenhaPorEmail('a@t.com')
            self.assertEqual((trava.num_requests, trava.duration), (3, 900))


class RedefinirSenhaTest(Base):
    def _pedido(self, email='buscando@t.com'):
        self.pedir(email)
        return self.link_do_ultimo_email()

    def test_redefinicao_valida_permite_entrar_com_a_nova_senha_e_recusa_a_antiga(self):
        uid, token = self._pedido()
        res = self.redefinir(uid, token)
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        self.assertEqual(res.json()['detail'], 'Senha redefinida. Entre com a nova senha.')
        self.assertEqual(self.entrar('buscando@t.com', NOVA).status_code, 200)
        self.assertEqual(self.entrar('buscando@t.com', SENHA).status_code, 401)

    def test_token_usado_nao_vale_de_novo(self):
        uid, token = self._pedido()
        self.assertEqual(self.redefinir(uid, token).status_code, 200)
        res = self.redefinir(uid, token, nova='OutraSenha@2026y')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['detail'], MENSAGEM_LINK_INVALIDO)
        self.assertEqual(self.entrar('buscando@t.com', NOVA).status_code, 200, 'a senha não mudou na 2ª tentativa')

    def test_token_adulterado(self):
        uid, token = self._pedido()
        for ruim in (token[:-1] + ('a' if token[-1] != 'a' else 'b'), token + 'x', 'abc-123', '', token.upper()):
            res = self.redefinir(uid, ruim)
            self.assertEqual(res.status_code, 400, ruim)
        self.assertEqual(self.redefinir(uid, 'abc-123').json()['detail'], MENSAGEM_LINK_INVALIDO)

    def test_token_de_outro_usuario_nao_vale_para_este_uid(self):
        _, token = self._pedido('buscando@t.com')
        from usuarios.senha import codificar_uid
        res = self.redefinir(codificar_uid(self.uo), token)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['detail'], MENSAGEM_LINK_INVALIDO)

    def test_token_expirado_apos_1_hora(self):
        uid, token = self._pedido()
        quase = datetime.now() + timedelta(minutes=59)
        with mock.patch.object(default_token_generator, '_now', return_value=quase):
            self.assertTrue(default_token_generator.check_token(self.ub, token), 'com 59 min ainda vale')
        depois = datetime.now() + timedelta(hours=1, seconds=30)
        with mock.patch.object(default_token_generator, '_now', return_value=depois):
            res = self.redefinir(uid, token)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['detail'], MENSAGEM_LINK_INVALIDO)
        self.assertEqual(self.entrar('buscando@t.com', SENHA).status_code, 200, 'a senha não mudou')

    def test_uid_invalido(self):
        _, token = self._pedido()
        for uid in ('abc', '!!!', 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTA', 'QQ', '99999999999999999999'):
            res = self.redefinir(uid, token)
            self.assertEqual(res.status_code, 400, uid)
            self.assertEqual(res.json()['detail'], MENSAGEM_LINK_INVALIDO, uid)

    def test_senha_fraca_e_recusada_sem_gastar_o_link(self):
        uid, token = self._pedido()
        for fraca, trecho in (('abc', 'mínimo 8'), ('12345678', 'numérica'), ('password', 'muito comum'),
                              ('buscando@t.com', 'parecida')):
            res = self.redefinir(uid, token, nova=fraca)
            self.assertEqual(res.status_code, 400, fraca)
            self.assertIn('nova_senha', res.json(), fraca)
            self.assertIn(trecho, ' '.join(res.json()['nova_senha']), fraca)
        self.assertEqual(self.redefinir(uid, token).status_code, 200, 'o link continua valendo depois de senhas fracas')

    def test_campos_ausentes_ou_com_tipo_errado(self):
        uid, token = self._pedido()
        for corpo in ({}, {'uid': uid}, {'uid': uid, 'token': token}, {'uid': 1, 'token': token, 'nova_senha': NOVA},
                      {'uid': uid, 'token': None, 'nova_senha': NOVA}, {'uid': uid, 'token': token, 'nova_senha': ''}):
            res = self.client.post(REDEFINIR, corpo, format='json')
            self.assertEqual(res.status_code, 400, f'{corpo}: {corpo_texto(res)}')
        self.assertEqual(self.client.post(REDEFINIR, ['x'], format='json').status_code, 400)

    def test_conta_suspensa_depois_do_pedido_nao_consegue_redefinir(self):
        uid, token = self._pedido()
        self.ub.is_active = False
        self.ub.save()
        res = self.redefinir(uid, token)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['detail'], MENSAGEM_LINK_INVALIDO)
        self.ub.refresh_from_db()
        self.assertFalse(self.ub.is_active, 'a rota não reativa a conta')
        self.assertTrue(self.ub.check_password(SENHA))

    def test_sessoes_abertas_sao_encerradas(self):
        login1 = self.entrar('buscando@t.com', SENHA).json()
        login2 = self.entrar('buscando@t.com', SENHA).json()
        uid, token = self._pedido()
        self.assertEqual(self.redefinir(uid, token).status_code, 200)
        for tokens in (login1, login2):
            res = APIClient().post('/api/auth/login/refresh/', {'refresh': tokens['refresh']}, format='json')
            self.assertEqual(res.status_code, 401, 'o refresh anterior à redefinição deve ser recusado')
        novo = self.entrar('buscando@t.com', NOVA).json()
        res = APIClient().post('/api/auth/login/refresh/', {'refresh': novo['refresh']}, format='json')
        self.assertEqual(res.status_code, 200, 'a sessão aberta DEPOIS da redefinição vale')

    def test_sessoes_de_outro_usuario_nao_sao_afetadas(self):
        outro = APIClient().post(LOGIN, {'email': 'oferece@t.com', 'password': SENHA}, format='json').json()
        uid, token = self._pedido()
        self.redefinir(uid, token)
        res = APIClient().post('/api/auth/login/refresh/', {'refresh': outro['refresh']}, format='json')
        self.assertEqual(res.status_code, 200)

    @override_settings(LOGIN_LIMITE_EMAIL='3/hour', LOGIN_LIMITE_IP='off')
    def test_zera_o_contador_de_tentativas_de_login_do_email(self):
        for _ in range(3):
            self.entrar('buscando@t.com', 'errada')
        self.assertEqual(self.entrar('buscando@t.com', SENHA).status_code, 429, 'bloqueado pelo limite')
        uid, token = self._pedido()
        self.assertEqual(self.redefinir(uid, token).status_code, 200)
        self.assertEqual(self.entrar('buscando@t.com', NOVA).status_code, 200, 'o bloqueio foi zerado')

    def test_nao_exige_login(self):
        uid, token = self._pedido()
        res = self.client.post(REDEFINIR, {'uid': uid, 'token': token, 'nova_senha': NOVA}, format='json', HTTP_AUTHORIZATION='Bearer lixo')
        self.assertEqual(res.status_code, 200)


class LogsDaRecuperacaoTest(Base):
    def test_solicitacao_e_redefinicao_sao_registradas_sem_dados_sensiveis(self):
        self.pedir('buscando@t.com')
        uid, token = self.link_do_ultimo_email()
        link = mail.outbox[0].body.split('\n')[5] if False else f'uid={uid}&token={token}'
        self.client.post(REDEFINIR, {'uid': uid, 'token': token, 'nova_senha': NOVA}, format='json')

        acoes = list(LogOperacao.objects.order_by('id').values_list('acao', flat=True))
        self.assertEqual(acoes, ['SENHA_SOLICITADA', 'SENHA_REDEFINIDA'])
        solicitada, redefinida = LogOperacao.objects.order_by('id')
        self.assertEqual(solicitada.usuario, self.ub)
        self.assertEqual(solicitada.detalhes, {'resultado': 'enviado'})
        self.assertEqual(redefinida.detalhes, {'sessoes_encerradas': 0})
        self.assertEqual(redefinida.get_acao_display(), 'Senha redefinida')
        self.assertEqual(solicitada.get_acao_display(), 'Redefinição de senha solicitada')

        tudo = json.dumps(list(LogOperacao.objects.values('acao', 'entidade', 'entidade_id', 'detalhes', 'ip')), default=str)
        for segredo in (NOVA, SENHA, token, uid, link, 'buscando@t.com', 'token', 'senha', 'http'):
            self.assertNotIn(segredo, tudo, f'o log não pode conter {segredo!r}')

    def test_filtro_por_acao_na_api_de_logs(self):
        self.pedir('buscando@t.com')
        res = self.como(self.adm).get('/api/admin/logs/', {'acao': 'SENHA_SOLICITADA'})
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        self.assertEqual(res.json()['count'], 1)
        self.assertEqual(res.json()['results'][0]['acao_label'], 'Redefinição de senha solicitada')

    def test_pedido_de_email_inexistente_nao_gera_log(self):
        self.pedir('nao.existe@t.com')
        self.assertEqual(LogOperacao.objects.count(), 0)

    def test_senha_fraca_nao_gera_log_de_redefinicao(self):
        self.pedir('buscando@t.com')
        uid, token = self.link_do_ultimo_email()
        self.client.post(REDEFINIR, {'uid': uid, 'token': token, 'nova_senha': '123'}, format='json')
        self.assertFalse(LogOperacao.objects.filter(acao='SENHA_REDEFINIDA').exists())


class RegistroAcoesTest(BaseSprint9):
    def test_catalogo_de_acoes_tem_as_18_e_rotulos_em_portugues(self):
        from logs.models import LogOperacao as L
        rotulos = dict(L.ACAO_CHOICES)
        self.assertEqual(len(rotulos), 18)  # 17 + IA_TESTE (Afinidade por IA)
        self.assertEqual(rotulos['IA_TESTE'], 'Teste da IA (painel)')  # rótulo exibido: LogOperacao.ROTULO_EXIBIDO
        self.assertEqual(rotulos['SENHA_SOLICITADA'], 'Redefinição de senha solicitada')
        self.assertEqual(rotulos['SENHA_REDEFINIDA'], 'Senha redefinida')
