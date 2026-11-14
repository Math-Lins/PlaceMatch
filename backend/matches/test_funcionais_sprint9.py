"""Sprint 9 — testes funcionais (CT-F) e de validação (CT-V) de descoberta, curtidas e matches."""
from matches.models import Curtida, Match
from placematch.testutils_sprint9 import (
    BaseSprint9, corpo_texto, criar_perfil, criar_usuario, reg, tem_ingles,
)

CURTIDAS = '/api/curtidas/'
DESCOBERTA = '/api/descoberta/'
MATCHES = '/api/matches/'


class FuncionaisMatchTest(BaseSprint9):
    def test_ctf13_descoberta_lista_tipo_oposto(self):
        res = self.como(self.ub).get(DESCOBERTA)
        self.assertEqual(res.status_code, 200)
        self.assertEqual([p['id'] for p in res.json()], [self.po.id])
        self.assertIn('score', res.json()[0])

    def test_ctf14_descoberta_com_filtro(self):
        res = self.como(self.ub).get(DESCOBERTA, {'regiao': 'Inexistente'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

    def test_ctf15_curtir_201_sem_match(self):
        res = self.como(self.ub).post(
            CURTIDAS, {'perfil_destino': self.po.id, 'tipo': 'curtir'}, format='json')
        self.assertEqual(res.status_code, 201, corpo_texto(res))
        self.assertFalse(res.json()['match'])
        self.assertEqual(Curtida.objects.count(), 1)

    def test_ctf16_recusar_201_e_some_da_descoberta(self):
        c = self.como(self.ub)
        res = c.post(CURTIDAS, {'perfil_destino': self.po.id, 'tipo': 'recusar'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(c.get(DESCOBERTA).json(), [])

    def test_ctf17_curtida_mutua_gera_match_e_lista(self):
        self.como(self.ub).post(CURTIDAS, {'perfil_destino': self.po.id, 'tipo': 'curtir'}, format='json')
        res = self.como(self.uo).post(
            CURTIDAS, {'perfil_destino': self.pb.id, 'tipo': 'curtir'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.json()['match'])
        self.assertEqual(Match.objects.count(), 1)
        lista = self.como(self.ub).get(MATCHES)
        self.assertEqual(lista.status_code, 200)
        self.assertEqual(len(lista.json()), 1)

    def test_ctf18_matches_vazio_para_usuario_sem_matches(self):
        res = self.como(self.ub).get(MATCHES)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])


class ValidacaoCurtidaTest(BaseSprint9):
    def _post(self, ct, corpo, usuario=None, **kw):
        res = self.como(usuario or self.ub).post(CURTIDAS, corpo, format='json', **kw)
        reg(ct, res)
        return res

    def _400(self, res):
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv56_perfil_inexistente(self):
        res = self._post('CT-V56', {'perfil_destino': 999999, 'tipo': 'curtir'})
        self._400(res)
        self.assertIn('perfil_destino', res.json())

    def test_ctv57_sem_corpo(self):
        res = self.como(self.ub).post(CURTIDAS)
        reg('CT-V57', res)
        self._400(res)
        self.assertIn('perfil_destino', res.json())
        self.assertIn('tipo', res.json())

    def test_ctv58_tipo_acao_invalido(self):
        res = self._post('CT-V58', {'perfil_destino': self.po.id, 'tipo': 'amar'})
        self._400(res)
        self.assertIn('tipo', res.json())

    def test_ctv59_perfil_destino_texto(self):
        res = self._post('CT-V59', {'perfil_destino': 'abc', 'tipo': 'curtir'})
        self._400(res)
        self.assertIn('perfil_destino', res.json())

    def test_ctv60_perfil_destino_nulo(self):
        res = self._post('CT-V60', {'perfil_destino': None, 'tipo': 'curtir'})
        self._400(res)
        self.assertIn('perfil_destino', res.json())

    def test_ctv61_curtir_proprio_perfil(self):
        self._400(self._post('CT-V61', {'perfil_destino': self.pb.id, 'tipo': 'curtir'}))

    def test_ctv62_curtida_duplicada(self):
        self._post('CT-V62a', {'perfil_destino': self.po.id, 'tipo': 'curtir'})
        self._400(self._post('CT-V62', {'perfil_destino': self.po.id, 'tipo': 'curtir'}))

    def test_ctv63_curtir_mesmo_tipo(self):
        outro = criar_perfil(criar_usuario('b2@t.com', 'buscando_vaga'))
        self._400(self._post('CT-V63', {'perfil_destino': outro.id, 'tipo': 'curtir'}))

    def test_ctv64_corpo_nao_objeto(self):
        res = self._post('CT-V64', [1])
        self._400(res)

    def test_ctv65_usuario_sem_perfil(self):
        sem = criar_usuario('sem@t.com', 'buscando_vaga')
        self._400(self._post('CT-V65', {'perfil_destino': self.po.id, 'tipo': 'curtir'}, usuario=sem))

    def test_ctv66_admin_nao_curte(self):
        res = self._post('CT-V66', {'perfil_destino': self.po.id, 'tipo': 'curtir'}, usuario=self.adm)
        self.assertEqual(res.status_code, 403)
    def test_ctv67_curtir_perfil_de_usuario_suspenso(self):
        """Perfil de conta suspensa não aparece na descoberta; também não deveria ser curtível."""
        self.uo.is_active = False
        self.uo.save()
        res = self._post('CT-V67', {'perfil_destino': self.po.id, 'tipo': 'curtir'})
        self.assertIn(res.status_code, (400, 404), corpo_texto(res))


class ValidacaoFiltrosDescobertaTest(BaseSprint9):
    def _get(self, ct, params):
        res = self.como(self.ub).get(DESCOBERTA, params)
        reg(ct, res)
        return res

    def _400(self, res):
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv68_score_min_negativo(self):
        self._400(self._get('CT-V68', {'score_min': -1}))

    def test_ctv69_score_min_acima_de_100(self):
        self._400(self._get('CT-V69', {'score_min': 101}))

    def test_ctv70_score_min_texto(self):
        self._400(self._get('CT-V70', {'score_min': 'alto'}))

    def test_ctv71_orcamento_min_texto(self):
        self._400(self._get('CT-V71', {'orcamento_min': 'abc'}))
    def test_ctv72_orcamento_min_nan(self):
        res = self._get('CT-V72', {'orcamento_min': 'NaN'})
        self.assertLess(res.status_code, 500)
        self._400(res)
    def test_ctv73_orcamento_max_infinity(self):
        res = self._get('CT-V73', {'orcamento_max': 'Infinity'})
        self.assertLess(res.status_code, 500)
        self._400(res)

    def test_ctv74_ordenar_invalido(self):
        self._400(self._get('CT-V74', {'ordenar': 'x'}))

    def test_ctv75_bool_invalido(self):
        self._400(self._get('CT-V75', {'fumante': 'talvez'}))
    def test_ctv76_orcamento_negativo(self):
        self._400(self._get('CT-V76', {'orcamento_min': '-50'}))

    def test_ctv77_usuario_sem_perfil_na_descoberta(self):
        sem = criar_usuario('sem@t.com', 'buscando_vaga')
        res = self.como(sem).get(DESCOBERTA)
        reg('CT-V77', res)
        self._400(res)
