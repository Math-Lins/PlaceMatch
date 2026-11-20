"""Documentação da API (drf-spectacular): schema válido, cobertura de rotas e acesso a /api/docs/."""
import os
import tempfile
from io import StringIO
from pathlib import Path

import yaml
from django.conf import settings
from django.core.management import call_command
from django.test import override_settings
from drf_spectacular.generators import SchemaGenerator
from rest_framework.schemas.generators import EndpointEnumerator
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from placematch.api_docs import OPERACOES
from placematch.testutils_sprint9 import BaseSprint9

ROTAS_DA_DOCUMENTACAO = {'/api/schema/', '/api/docs/'}
METODOS = {'GET', 'POST', 'PUT', 'PATCH', 'DELETE'}
OPENAPI_YAML = Path(settings.BASE_DIR).parent / 'docs' / 'openapi.yaml'


def _schema():
    return SchemaGenerator().get_schema(request=None, public=True)


class SchemaValidoTest(APITestCase):
    def test_gera_sem_avisos_nem_erros(self):
        """Equivale a `manage.py spectacular --validate --fail-on-warn`."""
        saida, erro = StringIO(), StringIO()
        with tempfile.TemporaryDirectory() as pasta:
            arq = os.path.join(pasta, 'openapi.yaml')
            call_command('spectacular', '--validate', '--fail-on-warn', '--file', arq, stdout=saida, stderr=erro)
            self.assertTrue(os.path.getsize(arq) > 1000)
        self.assertNotIn('Warning', erro.getvalue() + saida.getvalue())
        self.assertNotIn('Error', erro.getvalue() + saida.getvalue())

    def test_openapi_3_com_titulo_e_versao(self):
        schema = _schema()
        self.assertTrue(schema['openapi'].startswith('3.'))
        self.assertEqual(schema['info']['title'], 'API do PlaceMatch')
        self.assertEqual(schema['info']['version'], '1.0.0-rc2')

    def test_autenticacao_bearer_jwt_para_o_botao_authorize(self):
        esquemas = _schema()['components']['securitySchemes']
        self.assertEqual(esquemas['jwtAuth']['scheme'], 'bearer')
        self.assertEqual(esquemas['jwtAuth']['bearerFormat'], 'JWT')


class CoberturaDasRotasTest(APITestCase):
    def _rotas_reais(self):
        # o DRF chama o parâmetro de {pk}; o schema usa {id}
        return {(metodo, caminho.replace('{pk}', '{id}')) for caminho, metodo, _ in EndpointEnumerator().get_api_endpoints()
                if metodo in METODOS and caminho not in ROTAS_DA_DOCUMENTACAO and caminho.startswith('/api/')}

    def _operacoes_do_schema(self):
        return {(metodo.upper(), caminho) for caminho, itens in _schema()['paths'].items()
                for metodo in itens if metodo.upper() in METODOS}

    def test_todas_as_rotas_de_api_aparecem_no_schema(self):
        reais, documentadas = self._rotas_reais(), self._operacoes_do_schema()
        self.assertGreaterEqual(len(reais), 31)
        self.assertEqual(reais - documentadas, set(), 'rotas reais sem documentação')
        self.assertEqual(documentadas - reais, set(), 'documentação de rotas que não existem')

    def test_toda_operacao_tem_grupo_resumo_descricao_e_respostas_de_erro(self):
        schema = _schema()
        ids = set()
        for caminho, itens in schema['paths'].items():
            for metodo, op in itens.items():
                if metodo.upper() not in METODOS:
                    continue
                ids.add(op['operationId'])
                self.assertTrue(op['tags'], (metodo, caminho))
                self.assertTrue(op['summary'], (metodo, caminho))
                self.assertTrue(len(op['description']) > 20, (metodo, caminho))
                self.assertTrue(op.get('x-quem-pode'), (metodo, caminho))
                codigos = set(op['responses'])
                self.assertTrue(codigos & {'200', '201', '204'}, (metodo, caminho))
                if OPERACOES[op['operationId']].get('publico'):
                    self.assertFalse(op.get('security'), (metodo, caminho))
                else:
                    self.assertIn('401', codigos, (metodo, caminho))
                    self.assertTrue(op.get('security'), (metodo, caminho))
        self.assertEqual(ids, set(OPERACOES), 'operações anotadas x operações do schema')

    def test_grupos_esperados(self):
        nomes = [t['name'] for t in _schema()['tags']]
        self.assertEqual(nomes, ['Autenticação', 'Perfis', 'Descoberta e Matches', 'Chat', 'Moderação',
                                 'Painel administrativo', 'Afinidade por IA', 'Logs'])

    def test_rotas_publicas_nao_pedem_token(self):
        paths = _schema()['paths']
        for caminho in ('/api/auth/registrar/', '/api/auth/login/', '/api/auth/login/refresh/'):
            self.assertFalse(paths[caminho]['post'].get('security'), caminho)
        self.assertTrue(paths['/api/auth/me/']['get']['security'])

    def test_exemplos_reais_em_cada_operacao(self):
        for caminho, itens in _schema()['paths'].items():
            for metodo, op in itens.items():
                if metodo.upper() not in METODOS:
                    continue
                com_exemplo = [r for r in op['responses'].values()
                               for conteudo in (r.get('content') or {}).values() if 'examples' in conteudo]
                if '204' in op['responses'] and len(op['responses']) <= 4:
                    continue
                self.assertTrue(com_exemplo, f'{metodo} {caminho} sem exemplo')


@override_settings(DEBUG=True)
class OpenApiYamlAtualizadoTest(APITestCase):
    def test_docs_openapi_yaml_acompanha_o_codigo(self):
        if not OPENAPI_YAML.exists():
            self.skipTest('docs/openapi.yaml fora do contêiner')
        em_arquivo = yaml.safe_load(OPENAPI_YAML.read_text(encoding='utf-8'))
        atual = yaml.safe_load(yaml.safe_dump(_schema(), allow_unicode=True))
        self.assertEqual(em_arquivo, atual, 'docs/openapi.yaml desatualizado: rode '
                         '`python manage.py spectacular --file ../docs/openapi.yaml`')


class AcessoADocumentacaoTest(BaseSprint9):
    """Aberta com DEBUG=True; em produção (DEBUG=False), somente administrador."""

    def _com_token(self, usuario):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(usuario)}')
        return c

    @override_settings(DEBUG=True)
    def test_em_desenvolvimento_fica_aberta(self):
        anonimo = APIClient()
        r = anonimo.get('/api/docs/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('swagger', r.content.decode().lower())
        s = anonimo.get('/api/schema/')
        self.assertEqual(s.status_code, 200)
        self.assertIn('openapi', s.content.decode()[:60].lower() + s.content.decode()[:200].lower())

    @override_settings(DEBUG=False)
    def test_em_producao_anonimo_e_usuario_comum_nao_acessam(self):
        for cliente in (APIClient(), self._com_token(self.ub)):
            for rota in ('/api/docs/', '/api/schema/'):
                self.assertIn(cliente.get(rota).status_code, (401, 403), rota)

    @override_settings(DEBUG=False)
    def test_em_producao_administrador_acessa(self):
        for rota in ('/api/docs/', '/api/schema/'):
            self.assertEqual(self._com_token(self.adm).get(rota).status_code, 200, rota)

    @override_settings(DEBUG=False)
    def test_em_producao_staff_logado_por_sessao_acessa(self):
        self.ub.is_staff = True
        self.ub.save()
        c = APIClient()
        c.force_login(self.ub)
        self.assertEqual(c.get('/api/docs/').status_code, 200)


class Erro404EmPortuguesTest(BaseSprint9):
    def test_404_do_drf_vem_em_portugues(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.ub)}')
        r = c.get('/api/perfis/999999/')
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json(), {'detail': 'Perfil não encontrado.'})
