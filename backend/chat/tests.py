from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status as http_status
from rest_framework.test import APIClient

from matches.models import Match
from perfis.models import Perfil
from .models import Mensagem

Usuario = get_user_model()

_counter = [0]


def _criar_usuario_e_perfil(tipo, nome='Teste', idade=25, regiao='Recife',
                             orcamento_min=800, orcamento_max=1500):
    _counter[0] += 1
    n = _counter[0]
    user = Usuario.objects.create_user(
        username=f'chat_user{n}',
        email=f'chat_user{n}@test.com',
        password='SenhaSegura123!',
        tipo=tipo,
    )
    perfil = Perfil.objects.create(
        usuario=user,
        nome=nome,
        idade=idade,
        regiao=regiao,
        orcamento_min=orcamento_min,
        orcamento_max=orcamento_max,
    )
    return user, perfil


def _criar_match(perfil_x, perfil_y, score=0.75):
    pa_id = min(perfil_x.id, perfil_y.id)
    pb_id = max(perfil_x.id, perfil_y.id)
    pa = perfil_x if perfil_x.id == pa_id else perfil_y
    pb = perfil_y if perfil_y.id == pb_id else perfil_x
    return Match.objects.create(perfil_a=pa, perfil_b=pb, score=score)


# ─── 1. Envio e listagem em ordem ────────────────────────────────────────────

class EnvioMensagemTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil('buscando_vaga', 'Alice')
        self.user_b, self.pb = _criar_usuario_e_perfil('oferecendo_vaga', 'Bruno')
        self.match = _criar_match(self.pa, self.pb)

    def test_envio_por_participante_retorna_201(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.post(
            f'/api/matches/{self.match.id}/mensagens/',
            {'conteudo': 'Olá, Bruno!'},
        )
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)
        self.assertEqual(res.data['conteudo'], 'Olá, Bruno!')
        self.assertEqual(res.data['remetente_id'], self.pa.id)
        self.assertEqual(res.data['match_id'], self.match.id)
        self.assertFalse(res.data['lida'])

    def test_mensagens_aparecem_em_ordem_cronologica(self):
        self.client.force_authenticate(user=self.user_a)
        self.client.post(f'/api/matches/{self.match.id}/mensagens/', {'conteudo': 'Primeira'})
        self.client.force_authenticate(user=self.user_b)
        self.client.post(f'/api/matches/{self.match.id}/mensagens/', {'conteudo': 'Segunda'})

        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(f'/api/matches/{self.match.id}/mensagens/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)
        self.assertEqual(res.data[0]['conteudo'], 'Primeira')
        self.assertEqual(res.data[1]['conteudo'], 'Segunda')


# ─── 2. Controle de acesso ───────────────────────────────────────────────────

class AcessoMensagensTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil('buscando_vaga')
        self.user_b, self.pb = _criar_usuario_e_perfil('oferecendo_vaga')
        self.user_c, self.pc = _criar_usuario_e_perfil('buscando_vaga', 'Carlos')
        self.match = _criar_match(self.pa, self.pb)

    def test_nao_participante_nao_lista_mensagens(self):
        self.client.force_authenticate(user=self.user_c)
        res = self.client.get(f'/api/matches/{self.match.id}/mensagens/')
        self.assertIn(res.status_code, [
            http_status.HTTP_403_FORBIDDEN,
            http_status.HTTP_404_NOT_FOUND,
        ])

    def test_nao_participante_nao_envia_mensagem(self):
        self.client.force_authenticate(user=self.user_c)
        res = self.client.post(
            f'/api/matches/{self.match.id}/mensagens/',
            {'conteudo': 'Intruso'},
        )
        self.assertIn(res.status_code, [
            http_status.HTTP_403_FORBIDDEN,
            http_status.HTTP_404_NOT_FOUND,
        ])

    def test_sem_token_get_retorna_401(self):
        res = self.client.get(f'/api/matches/{self.match.id}/mensagens/')
        self.assertEqual(res.status_code, http_status.HTTP_401_UNAUTHORIZED)

    def test_sem_token_post_retorna_401(self):
        res = self.client.post(
            f'/api/matches/{self.match.id}/mensagens/',
            {'conteudo': 'Sem token'},
        )
        self.assertEqual(res.status_code, http_status.HTTP_401_UNAUTHORIZED)

    def test_sem_token_conversas_retorna_401(self):
        res = self.client.get('/api/conversas/')
        self.assertEqual(res.status_code, http_status.HTTP_401_UNAUTHORIZED)


# ─── 3. Validação de conteúdo ────────────────────────────────────────────────

class ValidacaoConteudoTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil('buscando_vaga')
        self.user_b, self.pb = _criar_usuario_e_perfil('oferecendo_vaga')
        self.match = _criar_match(self.pa, self.pb)
        self.client.force_authenticate(user=self.user_a)

    def _post(self, conteudo):
        return self.client.post(
            f'/api/matches/{self.match.id}/mensagens/',
            {'conteudo': conteudo},
        )

    def test_conteudo_vazio_retorna_400(self):
        res = self._post('')
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('vazio', res.data.get('detail', '').lower())

    def test_conteudo_so_espacos_retorna_400(self):
        res = self._post('   ')
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('vazio', res.data.get('detail', '').lower())

    def test_conteudo_1001_chars_retorna_400(self):
        res = self._post('x' * 1001)
        self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('1000', res.data.get('detail', ''))

    def test_conteudo_1000_chars_e_valido(self):
        res = self._post('x' * 1000)
        self.assertEqual(res.status_code, http_status.HTTP_201_CREATED)


# ─── 4. Marcação de lidas ────────────────────────────────────────────────────

class MarcarLidaTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil('buscando_vaga', 'Alice')
        self.user_b, self.pb = _criar_usuario_e_perfil('oferecendo_vaga', 'Bruno')
        self.match = _criar_match(self.pa, self.pb)

    def test_listar_marca_mensagens_do_outro_como_lida(self):
        # A envia mensagem; B lista → deve marcar como lida
        Mensagem.objects.create(match=self.match, remetente=self.pa, conteudo='Oi')

        self.client.force_authenticate(user=self.user_b)
        self.client.get(f'/api/matches/{self.match.id}/mensagens/')

        msg = Mensagem.objects.get(match=self.match, remetente=self.pa)
        self.assertTrue(msg.lida)

    def test_listar_nao_marca_proprias_mensagens_como_lida(self):
        # A envia mensagem; A lista → sua própria mensagem NÃO deve ser marcada como lida
        Mensagem.objects.create(match=self.match, remetente=self.pa, conteudo='Oi')

        self.client.force_authenticate(user=self.user_a)
        self.client.get(f'/api/matches/{self.match.id}/mensagens/')

        msg = Mensagem.objects.get(match=self.match, remetente=self.pa)
        self.assertFalse(msg.lida)


# ─── 5. Contagem de não lidas em /api/conversas/ ────────────────────────────

class ConversasNaoLidasTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil('buscando_vaga', 'Alice')
        self.user_b, self.pb = _criar_usuario_e_perfil('oferecendo_vaga', 'Bruno')
        self.match = _criar_match(self.pa, self.pb)

    def test_contagem_nao_lidas_antes_de_listar(self):
        Mensagem.objects.create(match=self.match, remetente=self.pa, conteudo='Msg1')
        Mensagem.objects.create(match=self.match, remetente=self.pa, conteudo='Msg2')

        self.client.force_authenticate(user=self.user_b)
        res = self.client.get('/api/conversas/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        conversa = next(c for c in res.data if c['match_id'] == self.match.id)
        self.assertEqual(conversa['nao_lidas'], 2)

    def test_contagem_nao_lidas_depois_de_listar(self):
        Mensagem.objects.create(match=self.match, remetente=self.pa, conteudo='Msg1')

        self.client.force_authenticate(user=self.user_b)
        # Lista mensagens → marca como lida
        self.client.get(f'/api/matches/{self.match.id}/mensagens/')

        res = self.client.get('/api/conversas/')
        conversa = next(c for c in res.data if c['match_id'] == self.match.id)
        self.assertEqual(conversa['nao_lidas'], 0)

    def test_proprias_mensagens_nao_contam_como_nao_lidas(self):
        # A envia mensagem; A verifica conversas → não deve contar como não lida para A
        Mensagem.objects.create(match=self.match, remetente=self.pa, conteudo='Oi')

        self.client.force_authenticate(user=self.user_a)
        res = self.client.get('/api/conversas/')
        conversa = next(c for c in res.data if c['match_id'] == self.match.id)
        self.assertEqual(conversa['nao_lidas'], 0)


# ─── 6. ?apos= ───────────────────────────────────────────────────────────────

class AposParametroTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil('buscando_vaga')
        self.user_b, self.pb = _criar_usuario_e_perfil('oferecendo_vaga')
        self.match = _criar_match(self.pa, self.pb)

        self.client.force_authenticate(user=self.user_a)
        r1 = self.client.post(f'/api/matches/{self.match.id}/mensagens/', {'conteudo': 'Msg1'})
        r2 = self.client.post(f'/api/matches/{self.match.id}/mensagens/', {'conteudo': 'Msg2'})
        r3 = self.client.post(f'/api/matches/{self.match.id}/mensagens/', {'conteudo': 'Msg3'})
        self.id1 = r1.data['id']
        self.id2 = r2.data['id']
        self.id3 = r3.data['id']

    def test_apos_retorna_apenas_mensagens_mais_novas(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(
            f'/api/matches/{self.match.id}/mensagens/?apos={self.id2}'
        )
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        ids = [m['id'] for m in res.data]
        self.assertNotIn(self.id1, ids)
        self.assertNotIn(self.id2, ids)
        self.assertIn(self.id3, ids)

    def test_apos_sem_novas_retorna_vazio(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(
            f'/api/matches/{self.match.id}/mensagens/?apos={self.id3}'
        )
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)


# ─── 7. /api/conversas/ — acesso e ordenação ────────────────────────────────

class ConversasOrdenacaoTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a, self.pa = _criar_usuario_e_perfil('buscando_vaga', 'Alice')
        self.user_b, self.pb = _criar_usuario_e_perfil('oferecendo_vaga', 'Bruno')
        self.user_c, self.pc = _criar_usuario_e_perfil('buscando_vaga', 'Carlos')
        self.user_d, self.pd = _criar_usuario_e_perfil('oferecendo_vaga', 'Diana')
        self.match_ab = _criar_match(self.pa, self.pb)
        self.match_ad = _criar_match(self.pa, self.pd)

    def test_conversas_so_traz_matches_do_usuario(self):
        # user_c não tem match com ninguém
        match_cb = _criar_match(self.pc, self.pb)
        Mensagem.objects.create(match=match_cb, remetente=self.pc, conteudo='Oi')

        self.client.force_authenticate(user=self.user_a)
        res = self.client.get('/api/conversas/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)
        ids = [c['match_id'] for c in res.data]
        self.assertIn(self.match_ab.id, ids)
        self.assertIn(self.match_ad.id, ids)
        self.assertNotIn(match_cb.id, ids)

    def test_conversas_ordena_match_com_mensagem_recente_primeiro(self):
        # Envia mensagem em match_ab primeiro, depois em match_ad
        self.client.force_authenticate(user=self.user_a)
        self.client.post(f'/api/matches/{self.match_ab.id}/mensagens/', {'conteudo': 'Msg antiga'})
        self.client.post(f'/api/matches/{self.match_ad.id}/mensagens/', {'conteudo': 'Msg recente'})

        res = self.client.get('/api/conversas/')
        ids = [c['match_id'] for c in res.data]
        self.assertLess(ids.index(self.match_ad.id), ids.index(self.match_ab.id))

    def test_conversas_match_sem_mensagem_vai_para_o_fim(self):
        # match_ab tem mensagem, match_ad não
        self.client.force_authenticate(user=self.user_a)
        self.client.post(f'/api/matches/{self.match_ab.id}/mensagens/', {'conteudo': 'Oi'})

        res = self.client.get('/api/conversas/')
        ids = [c['match_id'] for c in res.data]
        # match_ad (sem msg) criado depois → data_match mais recente,
        # mas match_ab tem mensagem ainda mais recente → match_ab deve vir primeiro
        self.assertLess(ids.index(self.match_ab.id), ids.index(self.match_ad.id))

    def test_conversas_retorna_ultima_mensagem_correta(self):
        self.client.force_authenticate(user=self.user_a)
        self.client.post(f'/api/matches/{self.match_ab.id}/mensagens/', {'conteudo': 'Primeira'})
        self.client.post(f'/api/matches/{self.match_ab.id}/mensagens/', {'conteudo': 'Ultima'})

        res = self.client.get('/api/conversas/')
        conversa = next(c for c in res.data if c['match_id'] == self.match_ab.id)
        self.assertEqual(conversa['ultima_mensagem']['conteudo'], 'Ultima')

    def test_conversas_sem_mensagem_tem_ultima_mensagem_null(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get('/api/conversas/')
        conversa = next(c for c in res.data if c['match_id'] == self.match_ab.id)
        self.assertIsNone(conversa['ultima_mensagem'])


# ─── 8. Cascade ──────────────────────────────────────────────────────────────

class CascadeTest(TestCase):
    def test_apagar_match_apaga_mensagens(self):
        _, pa = _criar_usuario_e_perfil('buscando_vaga')
        _, pb = _criar_usuario_e_perfil('oferecendo_vaga')
        match = _criar_match(pa, pb)
        Mensagem.objects.create(match=match, remetente=pa, conteudo='Oi')
        Mensagem.objects.create(match=match, remetente=pb, conteudo='Olá')

        self.assertEqual(Mensagem.objects.filter(match=match).count(), 2)
        match.delete()
        self.assertEqual(Mensagem.objects.filter(match_id=match.id).count(), 0)
