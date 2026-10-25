import datetime

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from usuarios.models import Usuario
from perfis.models import Perfil
from matches.models import Curtida, Match, Compatibilidade
from chat.models import Mensagem
from logs.models import LogOperacao


# ─── Helpers de criação ───────────────────────────────────────────────────────

def criar_usuario(email, tipo='buscando_vaga'):
    return Usuario.objects.create_user(
        username=email, email=email, password='senha1234', tipo=tipo
    )


def criar_perfil(usuario, regiao='Recife', **kwargs):
    defaults = dict(nome='Test', idade=25, orcamento_min=500, orcamento_max=1500)
    defaults.update(kwargs)
    # Salvar sem disparar signal de recalculo (ou com — não importa para os testes de painel)
    return Perfil.objects.create(usuario=usuario, regiao=regiao, **defaults)


def criar_match(p1, p2, score=0.8):
    pa_id = min(p1.id, p2.id)
    pb_id = max(p1.id, p2.id)
    return Match.objects.create(perfil_a_id=pa_id, perfil_b_id=pb_id, score=score)


def criar_curtida(origem, destino, tipo='curtir'):
    return Curtida.objects.create(perfil_origem=origem, perfil_destino=destino, tipo=tipo)


def criar_mensagem(match, remetente, conteudo='oi'):
    return Mensagem.objects.create(match=match, remetente=remetente, conteudo=conteudo)


# ─── Cenário base ─────────────────────────────────────────────────────────────

class PainelBaseTestCase(APITestCase):
    """
    Cenário:
      u1 (buscando_vaga) + p1 (Recife)
      u2 (oferecendo_vaga) + p2 (Recife)
      u3 (buscando_vaga) + p3 (Olinda)
      Curtidas: p1→p2 (curtir), p2→p1 (curtir), p3→p2 (recusar)
      Match: (p1, p2) score=0.8
      Mensagens: 2 de p1 no match
      admin: tipo=administrador
    """

    def setUp(self):
        self.admin = criar_usuario('adm@test.com', tipo='administrador')
        self.u1 = criar_usuario('u1@test.com', tipo='buscando_vaga')
        self.u2 = criar_usuario('u2@test.com', tipo='oferecendo_vaga')
        self.u3 = criar_usuario('u3@test.com', tipo='buscando_vaga')
        self.p1 = criar_perfil(self.u1, regiao='Recife')
        self.p2 = criar_perfil(self.u2, regiao='Recife')
        self.p3 = criar_perfil(self.u3, regiao='Olinda')
        criar_curtida(self.p1, self.p2, 'curtir')
        criar_curtida(self.p2, self.p1, 'curtir')
        criar_curtida(self.p3, self.p2, 'recusar')
        self.match = criar_match(self.p1, self.p2, score=0.8)
        criar_mensagem(self.match, self.p1, 'olá')
        criar_mensagem(self.match, self.p1, 'tudo bem?')
        # compatibilidade direta (o signal já teria criado, mas garantimos)
        Compatibilidade.objects.get_or_create(
            perfil_a=self.p1, perfil_b=self.p2, defaults={'score': 0.8}
        )
        self.client.force_authenticate(self.admin)


# ─── Permissões ───────────────────────────────────────────────────────────────

class PermissaoDashboardTest(APITestCase):
    def setUp(self):
        self.admin = criar_usuario('adm@test.com', tipo='administrador')
        self.regular = criar_usuario('reg@test.com', tipo='buscando_vaga')

    def test_anonimo_recebe_401(self):
        resp = self.client.get(reverse('dashboard'))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_nao_admin_recebe_403(self):
        self.client.force_authenticate(self.regular)
        resp = self.client.get(reverse('dashboard'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_acessa(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get(reverse('dashboard'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ─── KPIs exatos ──────────────────────────────────────────────────────────────

class DashboardKPIsTest(PainelBaseTestCase):
    def _dados(self, params=None):
        resp = self.client.get(reverse('dashboard'), params or {})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return resp.data

    def test_kpis_usuarios_total(self):
        # admin + u1 + u2 + u3 = 4
        d = self._dados()
        self.assertEqual(d['kpis']['usuarios_total'], 4)

    def test_kpis_perfis_total(self):
        d = self._dados()
        self.assertEqual(d['kpis']['perfis_total'], 3)

    def test_kpis_curtidas_total(self):
        # apenas tipo='curtir': p1→p2 e p2→p1 = 2
        d = self._dados()
        self.assertEqual(d['kpis']['curtidas_total'], 2)

    def test_kpis_recusas_total(self):
        d = self._dados()
        self.assertEqual(d['kpis']['recusas_total'], 1)

    def test_kpis_matches_total(self):
        d = self._dados()
        self.assertEqual(d['kpis']['matches_total'], 1)

    def test_kpis_taxa_match(self):
        # (1 * 2 / 2) * 100 = 100.0
        d = self._dados()
        self.assertEqual(d['kpis']['taxa_match'], 100.0)

    def test_kpis_mensagens_total(self):
        d = self._dados()
        self.assertEqual(d['kpis']['mensagens_total'], 2)

    def test_kpis_conversas_ativas(self):
        d = self._dados()
        self.assertEqual(d['kpis']['conversas_ativas'], 1)

    def test_kpis_score_medio(self):
        d = self._dados()
        self.assertAlmostEqual(d['kpis']['score_medio'], 0.8, places=2)

    def test_kpis_usuarios_por_tipo(self):
        d = self._dados()
        upt = d['kpis']['usuarios_por_tipo']
        self.assertEqual(upt.get('buscando_vaga'), 2)
        self.assertEqual(upt.get('oferecendo_vaga'), 1)
        self.assertEqual(upt.get('administrador'), 1)


# ─── Filtros ──────────────────────────────────────────────────────────────────

class DashboardFiltrosTest(PainelBaseTestCase):
    def test_filtro_regiao_altera_perfis(self):
        resp = self.client.get(reverse('dashboard'), {'regiao': 'Olinda'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['kpis']['perfis_total'], 1)
        self.assertEqual(resp.data['kpis']['matches_total'], 0)

    def test_filtro_tipo_buscando(self):
        resp = self.client.get(reverse('dashboard'), {'tipo': 'buscando_vaga'})
        self.assertEqual(resp.status_code, 200)
        # p1 e p3 são buscando_vaga
        self.assertEqual(resp.data['kpis']['perfis_total'], 2)

    def test_filtro_data_invalida_retorna_400(self):
        resp = self.client.get(reverse('dashboard'), {'data_inicio': 'nao-e-data'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('data_inicio', resp.data['detail'])

    def test_filtro_data_fim_invalida_retorna_400(self):
        resp = self.client.get(reverse('dashboard'), {'data_fim': '2024/01/01'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filtro_data_inicio_maior_que_fim_retorna_400(self):
        resp = self.client.get(reverse('dashboard'), {
            'data_inicio': '2025-01-10',
            'data_fim': '2025-01-01',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('data_inicio', resp.data['detail'])

    def test_filtros_aplicados_presentes_na_resposta(self):
        resp = self.client.get(reverse('dashboard'), {'regiao': 'Recife'})
        self.assertEqual(resp.data['filtros_aplicados'].get('regiao'), 'Recife')


# ─── Séries temporais com zeros ───────────────────────────────────────────────

class DashboardSeriesTest(PainelBaseTestCase):
    def test_series_tem_chaves_esperadas(self):
        resp = self.client.get(reverse('dashboard'))
        series = resp.data['series']
        for chave in ('matches_por_dia', 'curtidas_por_dia', 'mensagens_por_dia'):
            self.assertIn(chave, series)

    def test_serie_periodo_sem_dados_retorna_zeros(self):
        # Período no futuro distante — nenhum evento
        resp = self.client.get(reverse('dashboard'), {
            'data_inicio': '2099-01-01',
            'data_fim': '2099-01-03',
        })
        self.assertEqual(resp.status_code, 200)
        series = resp.data['series']
        # 3 dias com zero
        for chave in ('matches_por_dia', 'curtidas_por_dia', 'mensagens_por_dia'):
            self.assertEqual(len(series[chave]), 3)
            for item in series[chave]:
                self.assertEqual(item['total'], 0)

    def test_serie_inclui_todos_dias_do_periodo(self):
        hoje = datetime.date.today()
        ontem = hoje - datetime.timedelta(days=1)
        resp = self.client.get(reverse('dashboard'), {
            'data_inicio': str(ontem),
            'data_fim': str(hoje),
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['series']['matches_por_dia']), 2)


# ─── Top regiões e distribuição de score ─────────────────────────────────────

class DashboardTopRegioesTest(PainelBaseTestCase):
    def test_top_regioes_presente(self):
        resp = self.client.get(reverse('dashboard'))
        self.assertIn('top_regioes', resp.data)
        regioes = {r['regiao'] for r in resp.data['top_regioes']}
        self.assertIn('Recife', regioes)

    def test_top_regioes_maximo_8(self):
        resp = self.client.get(reverse('dashboard'))
        self.assertLessEqual(len(resp.data['top_regioes']), 8)

    def test_distribuicao_score_5_faixas(self):
        resp = self.client.get(reverse('dashboard'))
        dist = resp.data['distribuicao_score']
        self.assertEqual(len(dist), 5)
        faixas = {d['faixa'] for d in dist}
        for f in ('0-20', '20-40', '40-60', '60-80', '80-100'):
            self.assertIn(f, faixas)

    def test_distribuicao_score_faixa_correta(self):
        # score=0.8 → faixa 80-100
        resp = self.client.get(reverse('dashboard'))
        dist = {d['faixa']: d['total'] for d in resp.data['distribuicao_score']}
        self.assertGreaterEqual(dist['80-100'], 1)


# ─── Limite de queries (anti N+1) ─────────────────────────────────────────────

class DashboardQueryCountTest(PainelBaseTestCase):
    def test_numero_maximo_queries(self):
        """
        Garante ausência de N+1: o dashboard deve executar no máximo 35 queries
        independentemente do volume de dados (regiões e faixas são bounded).
        """
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        url = reverse('dashboard')
        with CaptureQueriesContext(connection) as ctx:
            resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertLessEqual(
            len(ctx), 35,
            f'Dashboard executou {len(ctx)} queries (máximo permitido: 35)',
        )


# ─── Período sem dados não devolve 500 ───────────────────────────────────────

class DashboardSemDadosTest(APITestCase):
    def setUp(self):
        self.admin = criar_usuario('adm@test.com', tipo='administrador')
        self.client.force_authenticate(self.admin)

    def test_periodo_sem_dados_retorna_zeros(self):
        resp = self.client.get(reverse('dashboard'), {
            'data_inicio': '2000-01-01',
            'data_fim': '2000-01-02',
        })
        self.assertEqual(resp.status_code, 200)
        kpis = resp.data['kpis']
        self.assertEqual(kpis['curtidas_total'], 0)
        self.assertEqual(kpis['matches_total'], 0)
        self.assertEqual(kpis['taxa_match'], 0.0)
        self.assertEqual(kpis['score_medio'], 0.0)


# ─── Catálogo de relatórios ───────────────────────────────────────────────────

class RelatoriosCatalogoTest(PainelBaseTestCase):
    def test_catalogo_tem_4_relatorios(self):
        resp = self.client.get(reverse('relatorios-catalogo'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 4)

    def test_catalogo_ids_corretos(self):
        resp = self.client.get(reverse('relatorios-catalogo'))
        ids = {r['id'] for r in resp.data}
        for rel_id in ('matches', 'compatibilidade-regiao', 'atividade', 'usuarios'):
            self.assertIn(rel_id, ids)

    def test_anonimo_recebe_401(self):
        self.client.logout()
        resp = self.client.get(reverse('relatorios-catalogo'))
        self.assertEqual(resp.status_code, 401)


# ─── Relatório inexistente ────────────────────────────────────────────────────

class RelatorioInexistenteTest(PainelBaseTestCase):
    def test_404_em_portugues(self):
        resp = self.client.get(reverse('relatorio-detalhe', args=['nao-existe']))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('nao-existe', resp.data['detail'])


# ─── Relatório matches ────────────────────────────────────────────────────────

class RelatorioMatchesTest(PainelBaseTestCase):
    def _dados(self, params=None):
        resp = self.client.get(
            reverse('relatorio-detalhe', args=['matches']), params or {}
        )
        self.assertEqual(resp.status_code, 200)
        return resp.data

    def test_colunas_presentes(self):
        d = self._dados()
        for col in ('Data', 'Perfil A', 'Perfil B', 'Score', 'Mensagens', 'Ativa'):
            self.assertIn(col, d['colunas'])

    def test_totais_corretos(self):
        d = self._dados()
        self.assertEqual(d['totais']['matches'], 1)
        self.assertEqual(d['totais']['mensagens'], 2)

    def test_linha_tem_ativa_sim(self):
        d = self._dados()
        ativas = [l[-1] for l in d['linhas']]
        self.assertIn('sim', ativas)

    def test_csv_tem_cabecalho_e_linha(self):
        resp = self.client.get(
            reverse('relatorio-detalhe', args=['matches']), {'formato': 'csv'}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('text/csv', resp['Content-Type'])
        content = resp.content.decode('utf-8-sig')
        lines = [l for l in content.strip().split('\n') if l]
        self.assertGreater(len(lines), 1)
        self.assertIn('Data', lines[0])
        # separador
        self.assertIn(';', lines[0])

    def test_csv_gera_log_relatorio_exportado(self):
        self.client.get(
            reverse('relatorio-detalhe', args=['matches']), {'formato': 'csv'}
        )
        log = LogOperacao.objects.filter(acao='RELATORIO_EXPORTADO').first()
        self.assertIsNotNone(log)
        self.assertIn('relatorio', log.detalhes)
        self.assertEqual(log.detalhes['relatorio'], 'matches')

    def test_json_nao_gera_log_exportado(self):
        LogOperacao.objects.filter(acao='RELATORIO_EXPORTADO').delete()
        self.client.get(reverse('relatorio-detalhe', args=['matches']))
        self.assertFalse(
            LogOperacao.objects.filter(acao='RELATORIO_EXPORTADO').exists()
        )


# ─── Relatório atividade ──────────────────────────────────────────────────────

class RelatorioAtividadeTest(PainelBaseTestCase):
    def test_colunas_presentes(self):
        resp = self.client.get(reverse('relatorio-detalhe', args=['atividade']))
        self.assertEqual(resp.status_code, 200)
        for col in ('Data', 'Curtidas', 'Recusas', 'Matches', 'Mensagens'):
            self.assertIn(col, resp.data['colunas'])

    def test_totais_corretos(self):
        resp = self.client.get(reverse('relatorio-detalhe', args=['atividade']))
        t = resp.data['totais']
        self.assertEqual(t['curtidas'], 2)
        self.assertEqual(t['recusas'], 1)
        self.assertEqual(t['matches'], 1)
        self.assertEqual(t['mensagens'], 2)


# ─── Relatório compatibilidade-regiao ────────────────────────────────────────

class RelatorioCompatibilidadeRegioTest(PainelBaseTestCase):
    def test_colunas_presentes(self):
        resp = self.client.get(
            reverse('relatorio-detalhe', args=['compatibilidade-regiao'])
        )
        self.assertEqual(resp.status_code, 200)
        for col in ('Região', 'Perfis', 'Matches', 'Score Médio'):
            self.assertIn(col, resp.data['colunas'])

    def test_recife_tem_2_perfis_e_1_match(self):
        resp = self.client.get(
            reverse('relatorio-detalhe', args=['compatibilidade-regiao']),
            {'regiao': 'Recife'},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['linhas']), 1)
        linha = resp.data['linhas'][0]
        col = resp.data['colunas']
        idx_perfis = col.index('Perfis')
        idx_matches = col.index('Matches')
        self.assertEqual(linha[idx_perfis], 2)
        self.assertEqual(linha[idx_matches], 1)


# ─── Relatório usuários ───────────────────────────────────────────────────────

class RelatorioUsuariosTest(PainelBaseTestCase):
    def test_colunas_presentes(self):
        resp = self.client.get(reverse('relatorio-detalhe', args=['usuarios']))
        self.assertEqual(resp.status_code, 200)
        for col in ('Data de Cadastro', 'Nome', 'E-mail', 'Tipo', 'Tem Perfil'):
            self.assertIn(col, resp.data['colunas'])

    def test_total_usuarios(self):
        resp = self.client.get(reverse('relatorio-detalhe', args=['usuarios']))
        self.assertEqual(resp.data['totais']['usuarios'], 4)  # admin + u1 + u2 + u3

    def test_filtro_tipo(self):
        resp = self.client.get(
            reverse('relatorio-detalhe', args=['usuarios']),
            {'tipo': 'buscando_vaga'},
        )
        self.assertEqual(resp.data['totais']['usuarios'], 2)  # u1 + u3

    def test_filtro_data_invalida_retorna_400(self):
        resp = self.client.get(
            reverse('relatorio-detalhe', args=['usuarios']),
            {'data_inicio': 'invalido'},
        )
        self.assertEqual(resp.status_code, 400)


# ─── CSV: codificação, separador e cabeçalho ─────────────────────────────────

class CSVFormatoTest(PainelBaseTestCase):
    def test_csv_utf8_sig(self):
        resp = self.client.get(
            reverse('relatorio-detalhe', args=['usuarios']), {'formato': 'csv'}
        )
        # BOM utf-8-sig
        self.assertTrue(resp.content.startswith(b'\xef\xbb\xbf'))

    def test_csv_separador_ponto_virgula(self):
        resp = self.client.get(
            reverse('relatorio-detalhe', args=['usuarios']), {'formato': 'csv'}
        )
        content = resp.content.decode('utf-8-sig')
        first_line = content.split('\n')[0]
        self.assertIn(';', first_line)
        self.assertNotIn(',', first_line)

    def test_csv_nome_arquivo_com_data(self):
        resp = self.client.get(
            reverse('relatorio-detalhe', args=['matches']), {'formato': 'csv'}
        )
        hoje = datetime.date.today().strftime('%Y%m%d')
        self.assertIn(hoje, resp['Content-Disposition'])


# ─── Admin: listagem de usuários ─────────────────────────────────────────────

class AdminUsuariosListaTest(PainelBaseTestCase):
    def test_admin_ve_lista(self):
        resp = self.client.get(reverse('admin-usuarios'))
        self.assertEqual(resp.status_code, 200)
        self.assertIn('count', resp.data)
        self.assertIn('results', resp.data)
        self.assertEqual(resp.data['count'], 4)  # admin + u1 + u2 + u3

    def test_anonimo_recebe_401(self):
        self.client.logout()
        resp = self.client.get(reverse('admin-usuarios'))
        self.assertEqual(resp.status_code, 401)

    def test_nao_admin_recebe_403(self):
        self.client.force_authenticate(self.u1)
        resp = self.client.get(reverse('admin-usuarios'))
        self.assertEqual(resp.status_code, 403)

    def test_resultado_nao_contem_senha(self):
        resp = self.client.get(reverse('admin-usuarios'))
        for u in resp.data['results']:
            self.assertNotIn('password', u)
            self.assertNotIn('password_hash', u)

    def test_campos_esperados_presentes(self):
        resp = self.client.get(reverse('admin-usuarios'))
        u = resp.data['results'][0]
        for campo in ('id', 'nome', 'email', 'tipo', 'data_cadastro', 'tem_perfil'):
            self.assertIn(campo, u)

    def test_filtro_tipo(self):
        resp = self.client.get(reverse('admin-usuarios'), {'tipo': 'buscando_vaga'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 2)  # u1 + u3
        for u in resp.data['results']:
            self.assertEqual(u['tipo'], 'buscando_vaga')

    def test_filtro_q_por_email(self):
        resp = self.client.get(reverse('admin-usuarios'), {'q': 'u1@'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 1)
        self.assertEqual(resp.data['results'][0]['email'], 'u1@test.com')

    def test_filtro_regiao(self):
        resp = self.client.get(reverse('admin-usuarios'), {'regiao': 'Olinda'})
        self.assertEqual(resp.status_code, 200)
        # Apenas u3 tem perfil em Olinda
        self.assertEqual(resp.data['count'], 1)

    def test_filtro_data_invalida_retorna_400(self):
        resp = self.client.get(reverse('admin-usuarios'), {'data_inicio': 'invalido'})
        self.assertEqual(resp.status_code, 400)

    def test_paginacao_page_size(self):
        resp = self.client.get(reverse('admin-usuarios'), {'page_size': 2, 'page': 1})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['results']), 2)
        self.assertEqual(resp.data['count'], 4)

    def test_paginacao_page2(self):
        resp = self.client.get(reverse('admin-usuarios'), {'page_size': 2, 'page': 2})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['results']), 2)


# ─── Admin: exportar usuários CSV ────────────────────────────────────────────

class AdminUsuariosExportarTest(PainelBaseTestCase):
    def test_csv_retorna_200_e_content_type_correto(self):
        resp = self.client.get(reverse('admin-usuarios-exportar'))
        self.assertEqual(resp.status_code, 200)
        self.assertIn('text/csv', resp['Content-Type'])

    def test_csv_tem_bom_utf8(self):
        resp = self.client.get(reverse('admin-usuarios-exportar'))
        self.assertTrue(resp.content.startswith(b'\xef\xbb\xbf'))

    def test_csv_tem_cabecalho_correto(self):
        resp = self.client.get(reverse('admin-usuarios-exportar'))
        content = resp.content.decode('utf-8-sig')
        primeira_linha = content.split('\n')[0]
        for col in ('ID', 'Nome', 'E-mail', 'Tipo'):
            self.assertIn(col, primeira_linha)

    def test_csv_separador_ponto_virgula(self):
        resp = self.client.get(reverse('admin-usuarios-exportar'))
        content = resp.content.decode('utf-8-sig')
        self.assertIn(';', content.split('\n')[0])

    def test_exportar_gera_log_relatorio_exportado(self):
        LogOperacao.objects.filter(acao='RELATORIO_EXPORTADO').delete()
        self.client.get(reverse('admin-usuarios-exportar'))
        self.assertTrue(
            LogOperacao.objects.filter(acao='RELATORIO_EXPORTADO').exists()
        )

    def test_anonimo_recebe_401(self):
        self.client.logout()
        resp = self.client.get(reverse('admin-usuarios-exportar'))
        self.assertEqual(resp.status_code, 401)

    def test_nao_admin_recebe_403(self):
        self.client.force_authenticate(self.u1)
        resp = self.client.get(reverse('admin-usuarios-exportar'))
        self.assertEqual(resp.status_code, 403)
