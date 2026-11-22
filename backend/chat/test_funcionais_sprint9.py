"""Sprint 9 — testes funcionais (CT-F) e de validação (CT-V) do chat/notificações (lado API)."""
from chat.models import Mensagem
from matches.models import Match
from placematch.testutils_sprint9 import (
    BaseSprint9, corpo_texto, criar_perfil, criar_usuario, reg, tem_ingles,
)

CONVERSAS = '/api/conversas/'


def _msgs(match_id):
    return f'/api/matches/{match_id}/mensagens/'


class _BaseChat(BaseSprint9):
    def setUp(self):
        super().setUp()
        a, b = sorted([self.pb.id, self.po.id])
        self.match = Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.8)


class FuncionaisChatTest(_BaseChat):
    def test_ctf19_listar_conversas(self):
        res = self.como(self.ub).get(CONVERSAS)
        self.assertEqual(res.status_code, 200)
        self.assertEqual([c['match_id'] for c in res.json()], [self.match.id])

    def test_ctf20_enviar_mensagem_201(self):
        res = self.como(self.ub).post(_msgs(self.match.id), {'conteudo': 'Oi!'}, format='json')
        self.assertEqual(res.status_code, 201, corpo_texto(res))
        self.assertEqual(Mensagem.objects.count(), 1)

    def test_ctf21_consultar_mensagens_e_marcar_lidas(self):
        Mensagem.objects.create(match=self.match, remetente=self.po, conteudo='ola')
        res = self.como(self.ub).get(_msgs(self.match.id))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 1)
        self.assertTrue(Mensagem.objects.get().lida)

    def test_ctf22_notificacoes_nao_lidas_via_conversas(self):
        """Backend não tem módulo de notificações: o front deriva de /conversas (nao_lidas)."""
        Mensagem.objects.create(match=self.match, remetente=self.po, conteudo='ola')
        res = self.como(self.ub).get(CONVERSAS, {'nao_lidas': 'true'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()[0]['nao_lidas'], 1)


class ValidacaoMensagemTest(_BaseChat):
    def _post(self, ct, corpo, match_id=None, usuario=None):
        res = self.como(usuario or self.ub).post(
            _msgs(match_id or self.match.id), corpo, format='json')
        reg(ct, res)
        return res

    def _400(self, res):
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv78_mensagem_vazia(self):
        self._400(self._post('CT-V78', {'conteudo': ''}))

    def test_ctv79_mensagem_so_espacos(self):
        self._400(self._post('CT-V79', {'conteudo': '    \n  '}))

    def test_ctv80_mensagem_1001_chars(self):
        self._400(self._post('CT-V80', {'conteudo': 'a' * 1001}))

    def test_ctv81_match_inexistente(self):
        res = self._post('CT-V81', {'conteudo': 'oi'}, match_id=999999)
        self.assertEqual(res.status_code, 404)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv82_sem_campo_conteudo(self):
        self._400(self._post('CT-V82', {}))
    def test_ctv83_conteudo_nao_texto(self):
        """Número/lista/objeto não são texto de mensagem válido."""
        self._400(self._post('CT-V83', {'conteudo': {'a': 1}}))

    def test_ctv84_nao_participante(self):
        outro = criar_usuario('x@t.com', 'buscando_vaga')
        criar_perfil(outro)
        res = self._post('CT-V84', {'conteudo': 'oi'}, usuario=outro)
        self.assertEqual(res.status_code, 403)

    def test_ctv85_usuario_sem_perfil(self):
        sem = criar_usuario('sem@t.com', 'buscando_vaga')
        res = self._post('CT-V85', {'conteudo': 'oi'}, usuario=sem)
        self.assertEqual(res.status_code, 400, corpo_texto(res))
    def test_ctv86_apos_invalido(self):
        mensagem = Mensagem.objects.create(match=self.match, remetente=self.po, conteudo='Ainda não lida')
        res = self.como(self.ub).get(_msgs(self.match.id), {'apos': 'abc'})
        reg('CT-V86', res)
        self._400(res)
        mensagem.refresh_from_db()
        self.assertFalse(mensagem.lida)
    def test_ctv87_enviar_para_match_com_usuario_suspenso(self):
        self.uo.is_active = False
        self.uo.save()
        res = self._post('CT-V87', {'conteudo': 'oi'})
        self.assertEqual(res.status_code, 403, corpo_texto(res))

    def test_ctv88_conteudo_exatamente_1000(self):
        res = self._post('CT-V88', {'conteudo': 'á' * 1000})
        self.assertEqual(res.status_code, 201)
