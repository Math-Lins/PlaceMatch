"""Sprint 9 — testes funcionais (CT-F) e de validação (CT-V) de logs de auditoria."""
from logs.models import LogOperacao
from placematch.testutils_sprint9 import BaseSprint9, corpo_texto, reg, tem_ingles

LOGS = '/api/admin/logs/'
EXPORTAR = '/api/admin/logs/exportar/'


class FuncionaisLogsTest(BaseSprint9):
    def setUp(self):
        super().setUp()
        LogOperacao.objects.create(acao='LOGIN', usuario=self.ub, entidade='usuario')
        LogOperacao.objects.create(acao='CURTIDA', usuario=self.ub, entidade='perfil')

    def test_ctf27_admin_lista_logs(self):
        res = self.como(self.adm).get(LOGS)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['count'], 2)

    def test_ctf28_filtrar_logs_por_acao(self):
        res = self.como(self.adm).get(LOGS, {'acao': 'LOGIN'})
        self.assertEqual(res.json()['count'], 1)

    def test_ctf29_exportar_logs_csv(self):
        res = self.como(self.adm).get(EXPORTAR)
        self.assertEqual(res.status_code, 200)
        self.assertIn('text/csv', res['Content-Type'])

    def test_ctf30_cadastro_e_login_geram_log(self):
        self.client.logout()
        self.client.post('/api/auth/registrar/', dict(
            username='zz', email='zz@t.com', password='Senha@Forte123', tipo='buscando_vaga'),
            format='json')
        self.assertTrue(LogOperacao.objects.filter(acao='CADASTRO').exists())

    def test_ctf31_usuario_comum_nao_acessa_logs(self):
        self.assertEqual(self.como(self.ub).get(LOGS).status_code, 403)


class ValidacaoFiltrosLogsTest(BaseSprint9):
    def _get(self, ct, params, url=LOGS):
        res = self.como(self.adm).get(url, params)
        reg(ct, res)
        return res
    def test_ctv108_data_inicio_formato_invalido(self):
        res = self._get('CT-V108', {'data_inicio': '31/12/2025'})
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertFalse(tem_ingles(corpo_texto(res)), corpo_texto(res))
    def test_ctv109_data_fim_inexistente(self):
        res = self._get('CT-V109', {'data_fim': '2025-13-45'})
        self.assertEqual(res.status_code, 400, corpo_texto(res))
    def test_ctv110_periodo_invertido(self):
        res = self._get('CT-V110', {'data_inicio': '2025-12-31', 'data_fim': '2025-01-01'})
        self.assertEqual(res.status_code, 400, corpo_texto(res))
    def test_ctv111_exportar_data_invalida(self):
        res = self._get('CT-V111', {'data_inicio': 'abc'}, url=EXPORTAR)
        self.assertEqual(res.status_code, 400, corpo_texto(res))
    def test_ctv112_exportar_periodo_invertido(self):
        res = self._get('CT-V112', {'data_inicio': '2025-12-31', 'data_fim': '2025-01-01'}, url=EXPORTAR)
        self.assertEqual(res.status_code, 400, corpo_texto(res))

    def test_ctv113_pagina_inexistente(self):
        res = self._get('CT-V113', {'page': 9999})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['results'], [])

    def test_ctv114_pagina_texto_nao_gera_500(self):
        res = self._get('CT-V114', {'page': 'abc', 'page_size': 'xyz'})
        self.assertLess(res.status_code, 500)
    def test_ctv115_acao_inexistente(self):
        res = self._get('CT-V115', {'acao': 'NAO_EXISTE'})
        self.assertEqual(res.status_code, 400, corpo_texto(res))
    def test_ctv116_usuario_id_gigante_nao_gera_500(self):
        """`usuario` aceita ID, e-mail ou nome; um ID fora do limite do banco não pode dar 500."""
        res = self._get('CT-V116', {'usuario': '9' * 30})
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        self.assertEqual(res.json()['count'], 0)


class FiltroUsuarioPeloFrontTest(BaseSprint9):
    """LogsTab.tsx tem o campo 'Usuário' com placeholder 'Nome ou e-mail' e envia `usuario=<texto>`."""
    def test_ctv134_filtro_usuario_por_email(self):
        LogOperacao.objects.create(acao='LOGIN', usuario=self.ub)
        LogOperacao.objects.create(acao='LOGIN', usuario=self.uo)
        res = self.como(self.adm).get(LOGS, {'usuario': 'buscando@t.com'})
        reg('CT-V134', res)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['count'], 1, corpo_texto(res))
