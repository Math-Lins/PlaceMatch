"""Auditoria da Release Candidate (docs/auditoria-rc.md): testes de regressão das correções.

Cada classe cobre um item da auditoria (AUD-xx) e falha no código anterior à correção.
"""
import csv
import io
from datetime import datetime, timezone as fuso_utc
from unittest import mock

from django.db import connection
from django.test import RequestFactory
from django.test.utils import CaptureQueriesContext

from logs.models import LogOperacao
from logs.servicos import registrar
from matches.models import Curtida, Match
from painel.exportacao import celula_br
from perfis.models import Perfil
from placematch.testutils_sprint9 import PERFIL_OK, BaseSprint9, corpo_texto, criar_perfil, criar_usuario

PERIGOSOS = ['=HYPERLINK("http://x","y")', '+1+1', '-2+3', '@SUM(A1)', '\t=1+1', '\r=1+1']


def _linhas_csv(res):
    texto = res.content.decode('utf-8-sig')
    return list(csv.reader(io.StringIO(texto), delimiter=';'))


class AUD01InjecaoDeFormulaNoCsvTest(BaseSprint9):
    """Valores que começam com = + - @ (ou TAB/CR) abrem como fórmula no Excel."""

    def test_celula_br_neutraliza_formulas_em_texto(self):
        for valor in PERIGOSOS:
            self.assertEqual(celula_br(valor), "'" + valor, valor)

    def test_celula_br_nao_altera_valores_normais(self):
        self.assertEqual(celula_br('Maria'), 'Maria')
        self.assertEqual(celula_br('a@b.com'), 'a@b.com')
        self.assertEqual(celula_br(-5), -5)          # número negativo de verdade não é texto
        self.assertEqual(celula_br(1.5), '1,50')
        self.assertEqual(celula_br(''), '')
        self.assertEqual(celula_br(None), '')

    def test_exportacao_de_usuarios_neutraliza_o_nome(self):
        criar_usuario('mal@t.com', first_name='=HYPERLINK("http://evil","x")')
        res = self.como(self.adm).get('/api/admin/usuarios/exportar/')
        self.assertEqual(res.status_code, 200)
        nomes = [linha[1] for linha in _linhas_csv(res)[1:]]
        self.assertIn("'=HYPERLINK(\"http://evil\",\"x\")", nomes)
        self.assertFalse([n for n in nomes if n.startswith('=')])

    def test_relatorio_de_usuarios_neutraliza_o_nome(self):
        criar_usuario('mal2@t.com', first_name='@SUM(1+1)')
        res = self.como(self.adm).get('/api/admin/relatorios/usuarios/?formato=csv')
        self.assertEqual(res.status_code, 200)
        nomes = [linha[1] for linha in _linhas_csv(res)[1:]]
        self.assertIn("'@SUM(1+1)", nomes)

    def test_relatorio_de_matches_neutraliza_nome_do_perfil(self):
        self.pb.nome = '=cmd|calc'
        self.pb.save()
        a, b = sorted([self.pb.id, self.po.id])
        Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.5)
        res = self.como(self.adm).get('/api/admin/relatorios/matches/?formato=csv')
        celulas = [c for linha in _linhas_csv(res)[1:] for c in linha]
        self.assertIn("'=cmd|calc", celulas)
        self.assertFalse([c for c in celulas if c.startswith('=')])

    def test_exportacao_de_logs_neutraliza_o_nome_do_usuario(self):
        mal = criar_usuario('mal3@t.com', first_name='+55 (81) 9999')
        registrar('LOGIN', usuario=mal, entidade='usuario')
        res = self.como(self.adm).get('/api/admin/logs/exportar/')
        nomes = [linha[3] for linha in _linhas_csv(res)[1:]]
        self.assertIn("'+55 (81) 9999", nomes)


class AUD02PaginacaoAlemDoFimTest(BaseSprint9):
    """Página com número gigante estourava o OFFSET do banco (500)."""

    def test_usuarios_com_pagina_gigante_devolve_lista_vazia(self):
        res = self.como(self.adm).get('/api/admin/usuarios/?page=99999999999999999999')
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        self.assertEqual(res.json()['results'], [])
        self.assertEqual(res.json()['count'], 3)

    def test_logs_com_pagina_gigante_devolve_lista_vazia(self):
        registrar('LOGIN', usuario=self.ub)
        res = self.como(self.adm).get('/api/admin/logs/?page=99999999999999999999&page_size=100')
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        self.assertEqual(res.json()['results'], [])
        self.assertEqual(res.json()['count'], 1)

    def test_pagina_normal_continua_funcionando(self):
        res = self.como(self.adm).get('/api/admin/usuarios/?page=1&page_size=2')
        self.assertEqual(len(res.json()['results']), 2)


class AUD03CurtidaDuplicadaConcorrenteTest(BaseSprint9):
    """Duas curtidas simultâneas passam pela checagem `exists()` e a segunda quebrava na restrição única."""

    def test_curtida_repetida_na_corrida_responde_400_e_nao_500(self):
        Curtida.objects.create(perfil_origem=self.pb, perfil_destino=self.po, tipo='curtir')
        chamadas = {'n': 0}
        original = Curtida.objects.filter

        class _QuaseVazio:
            def exists(self):
                return False

        def filtro(*args, **kwargs):
            chamadas['n'] += 1
            # a 1ª consulta é a checagem "já avaliou?": simula a outra requisição ainda não gravada
            return _QuaseVazio() if chamadas['n'] == 1 else original(*args, **kwargs)

        self.client.raise_request_exception = False
        with mock.patch('matches.views.Curtida.objects.filter', side_effect=filtro):
            res = self.como(self.ub).post(
                '/api/curtidas/', {'perfil_destino': self.po.id, 'tipo': 'curtir'}, format='json')
        self.assertEqual(res.status_code, 400, corpo_texto(res))
        self.assertEqual(res.json()['detail'], 'Você já avaliou este perfil.')
        self.assertEqual(Curtida.objects.filter(perfil_origem=self.pb, perfil_destino=self.po).count(), 1)


class AUD04CaracterNuloTest(BaseSprint9):
    """O PostgreSQL não aceita NUL (\\x00) em texto: a API respondia 500. Agora responde 400."""

    NUL = 'a\u0000b'

    def _match(self):
        a, b = sorted([self.pb.id, self.po.id])
        return Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.5)

    def test_mensagem_com_nul_e_rejeitada(self):
        m = self._match()
        res = self.como(self.ub).post(f'/api/matches/{m.id}/mensagens/', {'conteudo': self.NUL}, format='json')
        self.assertEqual(res.status_code, 400, corpo_texto(res))

    def test_fotos_do_imovel_com_nul_e_rejeitada(self):
        res = self.como(self.uo).patch(
            f'/api/perfis/{self.po.id}/', {'fotos_imovel': ['http://a/\u0000']}, format='json')
        self.assertEqual(res.status_code, 400, corpo_texto(res))

    def test_login_com_nul_no_email_responde_400(self):
        res = self.client.post('/api/auth/login/', {'email': 'a\u0000@t.com', 'password': 'x'}, format='json')
        self.assertEqual(res.status_code, 400, corpo_texto(res))

    def test_denuncia_com_nul_na_descricao_responde_400(self):
        res = self.como(self.ub).post(
            '/api/moderacao/denuncias/', {'denunciado': self.uo.id, 'motivo': 'spam', 'descricao': self.NUL},
            format='json')
        self.assertEqual(res.status_code, 400, corpo_texto(res))

    def test_parametro_de_busca_com_nul_responde_400(self):
        for url in ('/api/descoberta/?q=%00', '/api/conversas/?q=a%00b'):
            res = self.como(self.ub).get(url)
            self.assertEqual(res.status_code, 400, f'{url}: {corpo_texto(res)}')
        res = self.como(self.adm).get('/api/admin/usuarios/?q=%00')
        self.assertEqual(res.status_code, 400)

    def test_texto_normal_com_emoji_e_acento_continua_valido(self):
        m = self._match()
        res = self.como(self.ub).post(
            f'/api/matches/{m.id}/mensagens/', {'conteudo': 'Olá, São João 😀 — tudo bem?'}, format='json')
        self.assertEqual(res.status_code, 201, corpo_texto(res))


class AUD05PerfilDeContaSuspensaTest(BaseSprint9):
    """A Descoberta esconde contas suspensas, mas o detalhe do perfil por id continuava aberto."""

    def test_perfil_de_suspenso_nao_aparece_para_outro_usuario(self):
        self.uo.is_active = False
        self.uo.save()
        res = self.como(self.ub).get(f'/api/perfis/{self.po.id}/')
        self.assertEqual(res.status_code, 404, corpo_texto(res))
        self.assertEqual(res.json()['detail'], 'Perfil não encontrado.')

    def test_administrador_continua_vendo_perfil_de_suspenso(self):
        self.uo.is_active = False
        self.uo.save()
        res = self.como(self.adm).get(f'/api/perfis/{self.po.id}/')
        self.assertEqual(res.status_code, 200)

    def test_perfil_de_conta_ativa_continua_visivel(self):
        res = self.como(self.ub).get(f'/api/perfis/{self.po.id}/')
        self.assertEqual(res.status_code, 200)


class AUD06PeriodoPadraoDoPainelUsaFusoLocalTest(BaseSprint9):
    """O período padrão (últimos 30 dias) usava a data UTC: entre 21h e 24h (Brasília) já era "amanhã"."""

    def test_as_22h_de_brasilia_o_ultimo_dia_da_serie_e_hoje(self):
        # 2026-11-18 01:00 UTC = 2026-11-17 22:00 em America/Sao_Paulo
        agora = datetime(2026, 11, 18, 1, 0, tzinfo=fuso_utc.utc)
        with mock.patch('django.utils.timezone.now', return_value=agora):
            res = self.como(self.adm).get('/api/admin/dashboard/')
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        serie = res.json()['series']['matches_por_dia']
        self.assertEqual(serie[-1]['data'], '2026-11-17')
        self.assertEqual(serie[0]['data'], '2026-10-19')
        self.assertEqual(len(serie), 30)


class AUD07IpInvalidoNoCabecalhoNaoApagaOLogTest(BaseSprint9):
    """X-Forwarded-For inválido fazia a gravação do log falhar (silenciosamente): a ação ficava sem registro."""

    def _req(self, xff=None):
        extra = {'REMOTE_ADDR': '10.0.0.7'}
        if xff is not None:
            extra['HTTP_X_FORWARDED_FOR'] = xff
        return RequestFactory().get('/', **extra)

    def test_cabecalho_invalido_usa_o_ip_da_conexao(self):
        registrar('LOGIN', usuario=self.ub, request=self._req('nao-e-um-ip'))
        self.assertEqual(LogOperacao.objects.get().ip, '10.0.0.7')

    def test_cabecalho_valido_continua_sendo_usado(self):
        registrar('LOGIN', usuario=self.ub, request=self._req('203.0.113.9, 10.0.0.7'))
        self.assertEqual(LogOperacao.objects.get().ip, '203.0.113.9')

    def test_ipv6_valido_e_aceito(self):
        registrar('LOGIN', usuario=self.ub, request=self._req('2001:db8::1'))
        self.assertEqual(LogOperacao.objects.get().ip, '2001:db8::1')

    def test_sem_cabecalho_usa_o_ip_da_conexao(self):
        registrar('LOGIN', usuario=self.ub, request=self._req())
        self.assertEqual(LogOperacao.objects.get().ip, '10.0.0.7')


class AUD08ConsultasNasListasTest(BaseSprint9):
    """Descoberta e Matches faziam consultas extras por item (N+1)."""

    def _consultas(self, url):
        with CaptureQueriesContext(connection) as ctx:
            res = self.como(self.ub).get(url)
        self.assertEqual(res.status_code, 200, corpo_texto(res))
        return len(ctx), res.json()

    def _novos_oferecendo(self, n, inicio=0):
        for i in range(inicio, inicio + n):
            criar_perfil(criar_usuario(f'of{i}@t.com', 'oferecendo_vaga'), nome=f'Of {i}')

    def test_descoberta_tem_numero_fixo_de_consultas(self):
        self._novos_oferecendo(2)
        poucas, lista = self._consultas('/api/descoberta/')
        self.assertEqual(len(lista), 3)
        self._novos_oferecendo(10, inicio=2)
        muitas, lista = self._consultas('/api/descoberta/')
        self.assertEqual(len(lista), 13)
        self.assertEqual(muitas, poucas, 'o número de consultas não pode crescer com a quantidade de perfis')

    def test_descoberta_mantem_score_e_ordem(self):
        from matches.models import Compatibilidade
        self._novos_oferecendo(2)
        outros = list(Perfil.objects.filter(usuario__tipo='oferecendo_vaga').order_by('id'))
        for perfil, score in zip(outros, (0.2, 0.9, 0.5)):
            a, b = sorted([self.pb.id, perfil.id])
            Compatibilidade.objects.update_or_create(perfil_a_id=a, perfil_b_id=b, defaults={'score': score})
        _, lista = self._consultas('/api/descoberta/')
        self.assertEqual([p['score'] for p in lista], [0.9, 0.5, 0.2])

    def test_matches_tem_numero_fixo_de_consultas(self):
        def novo_match(i):
            p = criar_perfil(criar_usuario(f'm{i}@t.com', 'oferecendo_vaga'), nome=f'M {i}')
            a, b = sorted([self.pb.id, p.id])
            Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.5)
        novo_match(1)
        poucas, lista = self._consultas('/api/matches/')
        self.assertEqual(len(lista), 1)
        for i in range(2, 8):
            novo_match(i)
        muitas, lista = self._consultas('/api/matches/')
        self.assertEqual(len(lista), 7)
        self.assertEqual(muitas, poucas, 'o número de consultas não pode crescer com a quantidade de matches')
        self.assertIn(lista[0]['perfil_a']['tipo'], ('buscando_vaga', 'oferecendo_vaga'))
