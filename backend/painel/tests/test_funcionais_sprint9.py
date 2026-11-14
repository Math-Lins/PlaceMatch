"""Sprint 9 — testes funcionais (CT-F) e de validação (CT-V) de painel, relatórios e exportação."""
from placematch.testutils_sprint9 import BaseSprint9, corpo_texto, reg, tem_ingles

DASH = '/api/admin/dashboard/'
CATALOGO = '/api/admin/relatorios/'
USUARIOS = '/api/admin/usuarios/'
USUARIOS_EXP = '/api/admin/usuarios/exportar/'


def _rel(rid):
    return f'/api/admin/relatorios/{rid}/'


class FuncionaisPainelTest(BaseSprint9):
    def test_ctf32_dashboard(self):
        res = self.como(self.adm).get(DASH)
        self.assertEqual(res.status_code, 200)
        self.assertIn('kpis', res.json())

    def test_ctf33_catalogo_de_relatorios(self):
        res = self.como(self.adm).get(CATALOGO)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 5)

    def test_ctf34_relatorio_json(self):
        res = self.como(self.adm).get(_rel('usuarios'))
        self.assertEqual(res.status_code, 200)
        self.assertIn('linhas', res.json())

    def test_ctf35_relatorio_csv(self):
        res = self.como(self.adm).get(_rel('usuarios'), {'formato': 'csv'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('text/csv', res['Content-Type'])

    def test_ctf36_admin_lista_usuarios(self):
        res = self.como(self.adm).get(USUARIOS)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['count'], 3)

    def test_ctf37_exportar_usuarios_csv(self):
        res = self.como(self.adm).get(USUARIOS_EXP)
        self.assertEqual(res.status_code, 200)
        self.assertIn('text/csv', res['Content-Type'])

    def test_ctf38_usuario_comum_bloqueado(self):
        for url in (DASH, CATALOGO, USUARIOS, USUARIOS_EXP):
            self.assertEqual(self.como(self.ub).get(url).status_code, 403, url)


class ValidacaoFiltrosRelatorioTest(BaseSprint9):
    def _get(self, ct, url, params):
        res = self.como(self.adm).get(url, params)
        reg(ct, res)
        return res

    def _400(self, res):
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv117_relatorio_data_formato_invalido(self):
        self._400(self._get('CT-V117', _rel('matches'), {'data_inicio': '31-12-2025'}))

    def test_ctv118_relatorio_periodo_invertido(self):
        self._400(self._get('CT-V118', _rel('atividade'),
                            {'data_inicio': '2025-12-31', 'data_fim': '2025-01-01'}))

    def test_ctv119_relatorio_inexistente(self):
        res = self._get('CT-V119', _rel('nao-existe'), {})
        self.assertEqual(res.status_code, 404)
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))

    def test_ctv120_dashboard_data_invalida(self):
        self._400(self._get('CT-V120', DASH, {'data_fim': '2025-02-30'}))

    def test_ctv121_dashboard_periodo_invertido(self):
        self._400(self._get('CT-V121', DASH, {'data_inicio': '2025-12-31', 'data_fim': '2025-01-01'}))

    def test_ctv122_usuarios_data_invalida(self):
        self._400(self._get('CT-V122', USUARIOS, {'data_inicio': 'ontem'}))

    def test_ctv123_usuarios_exportar_periodo_invertido(self):
        self._400(self._get('CT-V123', USUARIOS_EXP,
                            {'data_inicio': '2025-12-31', 'data_fim': '2025-01-01'}))

    def test_ctv124_usuarios_pagina_inexistente(self):
        res = self._get('CT-V124', USUARIOS, {'page': 9999})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['results'], [])

    def test_ctv125_usuarios_pagina_texto_nao_gera_500(self):
        res = self._get('CT-V125', USUARIOS, {'page': 'x', 'page_size': 'y'})
        self.assertLess(res.status_code, 500)
    def test_ctv126_usuarios_filtro_ativo_invalido(self):
        self._400(self._get('CT-V126', USUARIOS, {'ativo': 'talvez'}))
    def test_ctv127_usuarios_filtro_tipo_invalido(self):
        self._400(self._get('CT-V127', USUARIOS, {'tipo': 'rei'}))
    def test_ctv128_relatorio_formato_invalido(self):
        self._400(self._get('CT-V128', _rel('usuarios'), {'formato': 'pdf'}))
    def test_ctv129_relatorio_tipo_invalido(self):
        self._400(self._get('CT-V129', _rel('usuarios'), {'tipo': 'rei'}))

    def test_ctv130_data_com_ano_absurdo(self):
        res = self._get('CT-V130', _rel('matches'), {'data_inicio': '0001-01-01'})
        self.assertLess(res.status_code, 500)
