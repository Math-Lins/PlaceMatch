"""Sprint 9 — testes funcionais (CT-F) e de validação (CT-V) de moderação."""
from moderacao.models import Denuncia
from placematch.testutils_sprint9 import (
    BaseSprint9, corpo_texto, reg, tem_ingles,
)

DEN = '/api/moderacao/denuncias/'
ADM_DEN = '/api/admin/moderacao/denuncias/'


def _susp(uid):
    return f'/api/admin/moderacao/usuarios/{uid}/suspender/'


def _reat(uid):
    return f'/api/admin/moderacao/usuarios/{uid}/reativar/'


class FuncionaisModeracaoTest(BaseSprint9):
    def _denunciar(self):
        return self.como(self.ub).post(
            DEN, {'denunciado': self.uo.id, 'motivo': 'spam', 'descricao': 'x'}, format='json')

    def test_ctf23_criar_denuncia_201(self):
        res = self._denunciar()
        self.assertEqual(res.status_code, 201, corpo_texto(res))
        self.assertEqual(Denuncia.objects.count(), 1)

    def test_ctf24_admin_lista_denuncias(self):
        self._denunciar()
        res = self.como(self.adm).get(ADM_DEN)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 1)

    def test_ctf25_admin_resolve_denuncia(self):
        self._denunciar()
        d = Denuncia.objects.get()
        res = self.como(self.adm).patch(
            f'{ADM_DEN}{d.id}/', {'status': 'resolvida', 'resolucao': 'ok'}, format='json')
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        d.refresh_from_db()
        self.assertEqual(d.status, 'resolvida')

    def test_ctf26_admin_suspende_e_reativa(self):
        c = self.como(self.adm)
        self.assertEqual(c.post(_susp(self.uo.id), {'motivo': 'abuso'}, format='json').status_code, 200)
        self.uo.refresh_from_db()
        self.assertFalse(self.uo.is_active)
        self.assertEqual(c.post(_reat(self.uo.id)).status_code, 200)
        self.uo.refresh_from_db()
        self.assertTrue(self.uo.is_active)


class ValidacaoDenunciaTest(BaseSprint9):
    def _post(self, ct, corpo):
        res = self.como(self.ub).post(DEN, corpo, format='json')
        reg(ct, res)
        return res

    def _400(self, res):
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv89_motivo_invalido(self):
        self._400(self._post('CT-V89', {'denunciado': self.uo.id, 'motivo': 'chato'}))
    def test_ctv90_descricao_acima_de_500(self):
        res = self._post('CT-V90', {'denunciado': self.uo.id, 'motivo': 'spam', 'descricao': 'd' * 501})
        self._400(res)

    def test_ctv91_usuario_inexistente(self):
        res = self._post('CT-V91', {'denunciado': 999999, 'motivo': 'spam'})
        self._400(res)
    def test_ctv92_denunciado_texto(self):
        res = self._post('CT-V92', {'denunciado': 'abc', 'motivo': 'spam'})
        self._400(res)
    def test_ctv93_denunciado_lista(self):
        res = self._post('CT-V93', {'denunciado': [1], 'motivo': 'spam'})
        self.assertLess(res.status_code, 500)
        self._400(res)

    def test_ctv94_sem_denunciado(self):
        self._400(self._post('CT-V94', {'motivo': 'spam'}))

    def test_ctv95_motivo_ausente(self):
        self._400(self._post('CT-V95', {'denunciado': self.uo.id}))

    def test_ctv96_auto_denuncia(self):
        self._400(self._post('CT-V96', {'denunciado': self.ub.id, 'motivo': 'spam'}))

    def test_ctv97_descricao_exatamente_500(self):
        res = self._post('CT-V97', {'denunciado': self.uo.id, 'motivo': 'spam', 'descricao': 'd' * 500})
        self.assertEqual(res.status_code, 201)
    def test_ctv98_corpo_nao_objeto(self):
        res = self.como(self.ub).post(DEN, [1], format='json')
        reg('CT-V98', res)
        self.assertLess(res.status_code, 500)
        self._400(res)


class ValidacaoAdminModeracaoTest(BaseSprint9):
    def setUp(self):
        super().setUp()
        self.den = Denuncia.objects.create(
            denunciante=self.ub, denunciado=self.uo, motivo='spam')

    def _patch(self, ct, corpo, did=None):
        res = self.como(self.adm).patch(f'{ADM_DEN}{did or self.den.id}/', corpo, format='json')
        reg(ct, res)
        return res

    def test_ctv99_resolver_status_invalido(self):
        res = self._patch('CT-V99', {'status': 'talvez'})
        self.assertEqual(res.status_code, 400)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv100_resolver_denuncia_inexistente(self):
        res = self._patch('CT-V100', {'status': 'resolvida'}, did=999999)
        self.assertEqual(res.status_code, 404)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv101_suspender_usuario_inexistente(self):
        res = self.como(self.adm).post(_susp(999999), {}, format='json')
        reg('CT-V101', res)
        self.assertEqual(res.status_code, 404)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv102_suspender_ja_suspenso(self):
        self.uo.is_active = False
        self.uo.save()
        res = self.como(self.adm).post(_susp(self.uo.id), {}, format='json')
        reg('CT-V102', res)
        self.assertEqual(res.status_code, 400)

    def test_ctv103_reativar_usuario_ativo(self):
        res = self.como(self.adm).post(_reat(self.uo.id), {}, format='json')
        reg('CT-V103', res)
        self.assertEqual(res.status_code, 400)
    def test_ctv104_resolucao_texto_muito_longo(self):
        res = self._patch('CT-V104', {'status': 'resolvida', 'resolucao': 'r' * 5000})
        self.assertEqual(res.status_code, 400, corpo_texto(res))
    def test_ctv105_motivo_suspensao_muito_longo(self):
        res = self.como(self.adm).post(_susp(self.uo.id), {'motivo': 'm' * 5000}, format='json')
        reg('CT-V105', res)
        self.assertEqual(res.status_code, 400, corpo_texto(res))
    def test_ctv106_listar_denuncias_status_invalido(self):
        res = self.como(self.adm).get(ADM_DEN, {'status': 'xyz'})
        reg('CT-V106', res)
        self.assertEqual(res.status_code, 400, corpo_texto(res))
    def test_ctv107_listar_denuncias_denunciado_texto(self):
        res = self.como(self.adm).get(ADM_DEN, {'denunciado': 'abc'})
        reg('CT-V107', res)
        self.assertLess(res.status_code, 500)
        self.assertEqual(res.status_code, 400, corpo_texto(res))
