"""Sprint 9 — testes funcionais (CT-F) e de validação (CT-V) de perfis."""
from perfis.models import Perfil
from placematch.testutils_sprint9 import (
    PERFIL_OK, BaseSprint9, corpo_texto, criar_usuario, reg, tem_ingles,
)

URL = '/api/perfis/'


class FuncionaisPerfilTest(BaseSprint9):
    def test_ctf05_criar_perfil_201(self):
        novo = criar_usuario('novo@t.com', 'buscando_vaga')
        res = self.como(novo).post(URL, PERFIL_OK, format='json')
        self.assertEqual(res.status_code, 201, corpo_texto(res))
        self.assertEqual(res.json()['usuario'], novo.id)

    def test_ctf06_listar_retorna_apenas_proprio(self):
        res = self.como(self.ub).get(URL)
        self.assertEqual(res.status_code, 200)
        ids = [p['id'] for p in res.json()]
        self.assertEqual(ids, [self.pb.id])

    def test_ctf07_consultar_perfil_do_tipo_oposto(self):
        res = self.como(self.ub).get(f'{URL}{self.po.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['id'], self.po.id)

    def test_ctf08_atualizar_put(self):
        dados = {**PERFIL_OK, 'nome': 'Nome Atualizado'}
        res = self.como(self.ub).put(f'{URL}{self.pb.id}/', dados, format='json')
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        self.pb.refresh_from_db()
        self.assertEqual(self.pb.nome, 'Nome Atualizado')

    def test_ctf09_atualizar_patch(self):
        res = self.como(self.ub).patch(f'{URL}{self.pb.id}/', {'bio': 'Nova bio'}, format='json')
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        self.pb.refresh_from_db()
        self.assertEqual(self.pb.bio, 'Nova bio')

    def test_ctf10_excluir_proprio_perfil_204(self):
        res = self.como(self.ub).delete(f'{URL}{self.pb.id}/')
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Perfil.objects.filter(id=self.pb.id).exists())

    def test_ctf11_nao_dono_nao_exclui_nem_edita(self):
        c = self.como(self.ub)
        self.assertIn(c.delete(f'{URL}{self.po.id}/').status_code, (403, 404))
        self.assertIn(c.patch(f'{URL}{self.po.id}/', {'bio': 'x'}, format='json').status_code, (403, 404))
        self.assertTrue(Perfil.objects.filter(id=self.po.id).exists())

    def test_ctf12_perfil_inexistente_404(self):
        res = self.como(self.ub).get(f'{URL}999999/')
        self.assertEqual(res.status_code, 404)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))


class ValidacaoPerfilTest(BaseSprint9):
    """Cada caso cria perfil para um usuário novo (sem perfil prévio)."""

    def setUp(self):
        super().setUp()
        self.novo = criar_usuario('novo@t.com', 'buscando_vaga')

    def _criar(self, ct, **mudancas):
        dados = {**PERFIL_OK, **mudancas}
        for k in [k for k, v in dados.items() if v is ...]:
            del dados[k]
        res = self.como(self.novo).post(URL, dados, format='json')
        reg(ct, res)
        return res

    def _400_campo(self, res, campo):
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertIn(campo, res.json(), corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv28_nome_vazio(self):
        self._400_campo(self._criar('CT-V28', nome=''), 'nome')

    def test_ctv29_nome_so_espacos(self):
        self._400_campo(self._criar('CT-V29', nome='   '), 'nome')

    def test_ctv30_idade_ausente(self):
        self._400_campo(self._criar('CT-V30', idade=...), 'idade')

    def test_ctv31_idade_menor_que_18(self):
        self._400_campo(self._criar('CT-V31', idade=17), 'idade')

    def test_ctv32_idade_absurda_200(self):
        self._400_campo(self._criar('CT-V32', idade=200), 'idade')

    def test_ctv33_idade_negativa(self):
        self._400_campo(self._criar('CT-V33', idade=-5), 'idade')

    def test_ctv34_idade_texto(self):
        self._400_campo(self._criar('CT-V34', idade='abc'), 'idade')

    def test_ctv35_orcamento_negativo(self):
        self._400_campo(self._criar('CT-V35', orcamento_min=-100), 'orcamento_min')

    def test_ctv36_orcamento_min_maior_que_max(self):
        self._400_campo(self._criar('CT-V36', orcamento_min=3000, orcamento_max=1000), 'orcamento_max')

    def test_ctv37_orcamento_texto(self):
        self._400_campo(self._criar('CT-V37', orcamento_min='muito'), 'orcamento_min')

    def test_ctv38_orcamento_ausente(self):
        self._400_campo(self._criar('CT-V38', orcamento_max=...), 'orcamento_max')

    def test_ctv39_tolerancia_bagunca_zero(self):
        self._400_campo(self._criar('CT-V39', tolerancia_bagunca=0), 'tolerancia_bagunca')

    def test_ctv40_nivel_organizacao_seis(self):
        self._400_campo(self._criar('CT-V40', nivel_organizacao=6), 'nivel_organizacao')

    def test_ctv41_nivel_ruido_negativo(self):
        self._400_campo(self._criar('CT-V41', nivel_ruido=-1), 'nivel_ruido')

    def test_ctv42_nivel_social_texto(self):
        self._400_campo(self._criar('CT-V42', nivel_social='alto'), 'nivel_social')

    def test_ctv43_bio_muito_longa(self):
        self._400_campo(self._criar('CT-V43', bio='x' * 501), 'bio')

    def test_ctv44_foto_perfil_url_invalida(self):
        self._400_campo(self._criar('CT-V44', foto_perfil_url='javascript:alert(1)'), 'foto_perfil_url')

    def test_ctv45_foto_perfil_url_so_esquema(self):
        self._400_campo(self._criar('CT-V45', foto_perfil_url='http://'), 'foto_perfil_url')
    def test_ctv46_segundo_perfil_do_mesmo_usuario(self):
        """Esperado: 400 com mensagem (nunca 500/IntegrityError)."""
        c = self.como(self.ub)  # já possui perfil
        res = c.post(URL, PERFIL_OK, format='json')
        reg('CT-V46', res)
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv47_regiao_vazia(self):
        self._400_campo(self._criar('CT-V47', regiao=''), 'regiao')

    def test_ctv48_nome_acima_de_150(self):
        self._400_campo(self._criar('CT-V48', nome='n' * 151), 'nome')

    def test_ctv49_idade_decimal(self):
        self._400_campo(self._criar('CT-V49', idade=25.5), 'idade')

    def test_ctv50_enum_invalido(self):
        self._400_campo(self._criar('CT-V50', tipo_imovel='castelo'), 'tipo_imovel')

    def test_ctv51_qtd_moradores_zero(self):
        self._400_campo(self._criar('CT-V51', qtd_moradores=0), 'qtd_moradores')

    def test_ctv52_patch_idade_invalida(self):
        res = self.como(self.ub).patch(f'{URL}{self.pb.id}/', {'idade': 15}, format='json')
        reg('CT-V52', res)
        self._400_campo(res, 'idade')

    def test_ctv53_patch_orcamento_min_maior_que_max_existente(self):
        res = self.como(self.ub).patch(f'{URL}{self.pb.id}/', {'orcamento_min': 99999}, format='json')
        reg('CT-V53', res)
        self.assertEqual(res.status_code, 400, corpo_texto(res))
    def test_ctv54_admin_nao_cria_perfil(self):
        res = self.como(self.adm).post(URL, PERFIL_OK, format='json')
        reg('CT-V54', res)
        self.assertEqual(res.status_code, 403, corpo_texto(res))

    def test_ctv55_orcamento_com_digitos_demais(self):
        self._400_campo(self._criar('CT-V55', orcamento_max=10 ** 12), 'orcamento_max')
