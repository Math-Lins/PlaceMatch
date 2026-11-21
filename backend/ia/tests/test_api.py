"""Rotas com a Afinidade por IA: Descoberta, detalhe do perfil, compatibilidade e rotas de administrador."""
from unittest import mock

from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext

from ia import servico
from ia.models import EmbeddingPerfil
from logs.models import LogOperacao
from matches.models import Compatibilidade

from .apoio import BIO_CULINARIA, BIO_CULINARIA_2, BIO_CURTA, BIO_FESTAS, BaseIA, admin, criar


class DescobertaComIATest(BaseIA):
    def setUp(self):
        super().setUp()
        self.ub, self.pb = criar('buscando_vaga', BIO_CULINARIA)
        self.uo1, self.po1 = criar('oferecendo_vaga', BIO_CULINARIA_2)
        self.uo2, self.po2 = criar('oferecendo_vaga', BIO_CURTA)

    def test_cada_item_traz_afinidade_e_temas(self):
        r = self.como(self.ub).get('/api/descoberta/')
        self.assertEqual(r.status_code, 200)
        itens = {i['id']: i for i in r.json()}
        self.assertGreater(itens[self.po1.id]['afinidade_ia'], 0.5)
        self.assertIn({'id': 'culinaria', 'nome': 'Culinária'}, itens[self.po1.id]['temas_em_comum'])
        self.assertIsNone(itens[self.po2.id]['afinidade_ia'])
        self.assertEqual(itens[self.po2.id]['temas_em_comum'], [])

    def test_sem_consultas_n_mais_1(self):
        def consultas():
            with CaptureQueriesContext(connection) as ctx:
                self.assertEqual(self.como(self.ub).get('/api/descoberta/').status_code, 200)
            return len(ctx.captured_queries)

        poucos = consultas()
        for i in range(6):
            criar('oferecendo_vaga', f'{BIO_FESTAS} Perfil número {i}.')
        self.assertEqual(consultas(), poucos)

    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada_devolve_null(self):
        itens = self.como(self.ub).get('/api/descoberta/').json()
        self.assertTrue(all(i['afinidade_ia'] is None and i['temas_em_comum'] == [] for i in itens))

    def test_meu_perfil_sem_bio_devolve_null_para_todos(self):
        self.pb.bio = BIO_CURTA
        self.pb.save()
        itens = self.como(self.ub).get('/api/descoberta/').json()
        self.assertTrue(all(i['afinidade_ia'] is None for i in itens))


class DetalhePerfilComIATest(BaseIA):
    def setUp(self):
        super().setUp()
        self.ub, self.pb = criar('buscando_vaga', BIO_CULINARIA)
        self.uo, self.po = criar('oferecendo_vaga', BIO_CULINARIA_2)

    def test_perfil_do_tipo_oposto_traz_a_afinidade(self):
        d = self.como(self.ub).get(f'/api/perfis/{self.po.id}/').json()
        self.assertGreater(d['afinidade_ia'], 0.5)
        self.assertIn('culinaria', [t['id'] for t in d['temas_em_comum']])
        self.assertEqual(d['nome'], self.po.nome)

    def test_proprio_perfil_e_admin_recebem_null(self):
        self.assertIsNone(self.como(self.ub).get(f'/api/perfis/{self.pb.id}/').json()['afinidade_ia'])
        d = self.como(admin()).get(f'/api/perfis/{self.pb.id}/').json()
        self.assertIsNone(d['afinidade_ia'])
        self.assertEqual(d['temas_em_comum'], [])

    def test_campos_de_ia_nao_aparecem_na_edicao(self):
        r = self.como(self.ub).patch(f'/api/perfis/{self.pb.id}/', {'afinidade_ia': 1, 'idade': 26}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertNotIn('afinidade_ia', r.json())


class CompatibilidadeDetalheTest(BaseIA):
    def setUp(self):
        super().setUp()
        self.ub, self.pb = criar('buscando_vaga', BIO_CULINARIA)
        self.uo, self.po = criar('oferecendo_vaga', BIO_CULINARIA_2, regiao='Olinda')
        self.uc, self.pc = criar('oferecendo_vaga', BIO_CURTA)

    def _get(self, usuario, perfil_id):
        return self.como(usuario).get(f'/api/compatibilidade/{perfil_id}/')

    def test_detalha_os_7_criterios_e_a_soma_e_o_score_gravado(self):
        r = self._get(self.ub, self.po.id)
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual([c['criterio'] for c in d['criterios']],
                         ['orcamento', 'regiao', 'rotina', 'habitos', 'moradia', 'idade', 'afinidade_ia'])
        gravado = Compatibilidade.objects.get(perfil_a_id=min(self.pb.id, self.po.id), perfil_b_id=max(self.pb.id, self.po.id)).score
        self.assertEqual(d['score'], gravado)
        self.assertAlmostEqual(sum(c['contribuicao'] for c in d['criterios']), d['score'], places=3)
        self.assertAlmostEqual(sum(c['peso_efetivo'] for c in d['criterios']), 1.0, places=3)
        ia = d['criterios'][-1]
        self.assertEqual((ia['nome'], ia['peso'], ia['peso_efetivo'], ia['considerado']), ('Afinidade de interesses (IA)', 0.1, 0.1, True))
        self.assertEqual(ia['valor'], d['afinidade_ia'])
        self.assertEqual(d['criterios'][1]['valor'], 0.0)  # regiões diferentes
        self.assertIn('culinaria', [t['id'] for t in d['temas_em_comum']])
        self.assertIn('culinaria', [t['id'] for t in d['temas_meu_perfil']])
        self.assertTrue(d['ia_disponivel'])
        self.assertIsNone(d['motivo_sem_ia'])
        self.assertIsInstance(d['similaridade_ia'], float)

    def test_sem_embedding_renormaliza_e_explica(self):
        d = self._get(self.ub, self.pc.id).json()
        self.assertIsNone(d['afinidade_ia'])
        self.assertEqual(d['score'], 1.0)
        ia = d['criterios'][-1]
        self.assertEqual((ia['valor'], ia['peso_efetivo'], ia['contribuicao'], ia['considerado']), (None, 0.0, 0.0, False))
        self.assertAlmostEqual(d['criterios'][0]['peso_efetivo'], round(0.23 / 0.9, 4))
        self.assertIn('Este perfil', d['motivo_sem_ia'])

    def test_meu_perfil_sem_embedding(self):
        self.pb.bio = ''
        self.pb.save()
        self.assertIn('Seu perfil', self._get(self.ub, self.po.id).json()['motivo_sem_ia'])

    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada(self):
        d = self._get(self.ub, self.po.id).json()
        self.assertIsNone(d['afinidade_ia'])
        self.assertFalse(d['ia_disponivel'])
        self.assertIn('desligada', d['motivo_sem_ia'])

    def test_modelo_fora_do_ar_nao_impede_a_consulta(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('sem rede')):
            r = self._get(self.ub, self.po.id)
        self.assertEqual(r.status_code, 200)
        self.assertIsNotNone(r.json()['afinidade_ia'])  # usa os vetores já gravados

    def test_permissoes_e_validacoes(self):
        self.assertEqual(self.client.get(f'/api/compatibilidade/{self.po.id}/').status_code, 401)
        r = self._get(admin(), self.po.id)
        self.assertEqual((r.status_code, r.json()['detail']), (403, 'O administrador não participa deste recurso.'))
        r = self._get(self.uo, self.pc.id)  # mesmo tipo
        self.assertEqual(r.status_code, 403)
        self.assertIn('tipo oposto', r.json()['detail'])
        self.assertEqual(self._get(self.ub, self.pb.id).status_code, 403)  # o próprio perfil
        self.assertEqual(self._get(self.ub, 999999).json(), {'detail': 'Perfil não encontrado.'})
        self.assertEqual(self._get(self.ub, 10 ** 30).status_code, 404)
        self.uo.is_active = False
        self.uo.save()
        self.assertEqual(self._get(self.ub, self.po.id).status_code, 404)  # conta suspensa

    def test_usuario_sem_perfil(self):
        u, p = criar('buscando_vaga')
        p.delete()
        r = self._get(u, self.po.id)
        self.assertEqual(r.status_code, 400)
        self.assertIn('criar um perfil', r.json()['detail'])


class IAStatusTest(BaseIA):
    def test_admin_ve_a_situacao(self):
        criar('buscando_vaga', BIO_CULINARIA)
        criar('oferecendo_vaga', BIO_CURTA)
        d = self.como(admin()).get('/api/admin/ia/status/').json()
        self.assertEqual((d['modelo'], d['dimensoes'], d['habilitada'], d['disponivel']), (servico.MODELO_FALSO, 384, True, True))
        self.assertEqual((d['perfis_total'], d['perfis_com_embedding'], d['perfis_com_texto_suficiente']), (2, 1, 1))
        self.assertEqual(d['perfis_sem_embedding_com_texto'], 0)
        self.assertEqual(d['temas_cadastrados'], 16)
        self.assertEqual(next(t for t in d['temas'] if t['id'] == 'culinaria')['perfis'], 1)
        self.assertIsNotNone(d['tempo_medio_geracao_ms'])
        self.assertIsNotNone(d['ultima_atualizacao'])
        self.assertEqual(d['calibracao']['peso'], 0.1)

    def test_conta_perfis_que_ficaram_sem_embedding(self):
        _, p = criar('buscando_vaga', BIO_CULINARIA)
        EmbeddingPerfil.objects.filter(perfil=p).delete()
        self.assertEqual(self.como(admin()).get('/api/admin/ia/status/').json()['perfis_sem_embedding_com_texto'], 1)

    def test_falha_de_carga_aparece_no_status(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('sem rede')), self.assertLogs('ia.servico'):
            servico.obter_embedder()
        d = self.como(admin()).get('/api/admin/ia/status/').json()
        self.assertEqual((d['situacao'], d['disponivel']), ('indisponivel', False))
        self.assertIn('sem rede', d['erro'])

    def test_somente_administrador(self):
        u, _ = criar()
        self.assertEqual(self.como(u).get('/api/admin/ia/status/').status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get('/api/admin/ia/status/').status_code, 401)


class IATestarTest(BaseIA):
    URL = '/api/admin/ia/testar/'

    def setUp(self):
        super().setUp()
        self.adm = admin()

    def test_compara_dois_textos(self):
        r = self.como(self.adm).post(self.URL, {'texto_a': BIO_CULINARIA, 'texto_b': BIO_CULINARIA_2}, format='json')
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertGreater(d['similaridade'], 0.5)
        self.assertTrue(0 <= d['afinidade'] <= 1)
        self.assertIn({'id': 'culinaria', 'nome': 'Culinária'}, d['temas_em_comum'])
        self.assertIn('culinaria', [t['id'] for t in d['temas_a']])
        self.assertGreaterEqual(d['tempo_ms'], 0)
        oposto = self.como(self.adm).post(self.URL, {'texto_a': BIO_CULINARIA, 'texto_b': BIO_FESTAS}, format='json').json()
        self.assertLess(oposto['afinidade'], d['afinidade'])

    def test_registra_o_log_sem_guardar_os_textos(self):
        self.como(self.adm).post(self.URL, {'texto_a': 'Texto secreto número um.', 'texto_b': 'Outro texto secreto.'}, format='json')
        log = LogOperacao.objects.get(acao='IA_TESTE')
        self.assertEqual(log.usuario, self.adm)
        self.assertEqual((log.detalhes['caracteres_a'], log.detalhes['caracteres_b']), (24, 20))
        self.assertNotIn('secreto', str(log.detalhes))

    def test_validacoes(self):
        c = self.como(self.adm)
        r = c.post(self.URL, {'texto_a': '   ', 'texto_b': 'x' * 1001}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(set(r.json()), {'texto_a', 'texto_b'})
        self.assertIn('1000', r.json()['texto_b'][0])
        self.assertEqual(set(c.post(self.URL, {}, format='json').json()), {'texto_a', 'texto_b'})
        self.assertEqual(c.post(self.URL, {'texto_a': ['lista'], 'texto_b': 'ok'}, format='json').status_code, 400)
        self.assertEqual(c.post(self.URL, {'texto_a': 'a' * 1000, 'texto_b': 'b'}, format='json').status_code, 200)
        self.assertFalse(LogOperacao.objects.filter(acao='IA_TESTE', detalhes__caracteres_b=1001).exists())

    def test_somente_administrador(self):
        u, _ = criar()
        self.assertEqual(self.como(u).post(self.URL, {'texto_a': 'a', 'texto_b': 'b'}, format='json').status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post(self.URL, {'texto_a': 'a', 'texto_b': 'b'}, format='json').status_code, 401)

    def test_modelo_indisponivel_responde_503_em_portugues(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('sem rede')), self.assertLogs('ia.servico'):
            r = self.como(self.adm).post(self.URL, {'texto_a': 'a', 'texto_b': 'b'}, format='json')
        self.assertEqual(r.status_code, 503)
        self.assertIn('não está disponível', r.json()['detail'])
        self.assertFalse(LogOperacao.objects.get(acao='IA_TESTE').detalhes['ia_disponivel'])

    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada_responde_503(self):
        r = self.como(self.adm).post(self.URL, {'texto_a': 'a', 'texto_b': 'b'}, format='json')
        self.assertEqual(r.status_code, 503)
        self.assertIn('desligada', r.json()['detail'])


class SemErro500Test(BaseIA):
    """Com o modelo fora do ar, nenhuma rota que usa a IA devolve 500."""

    def test_fluxo_completo_com_o_modelo_indisponivel(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('sem rede')), self.assertLogs('ia.servico'):
            ub, pb = criar('buscando_vaga', BIO_CULINARIA)
            uo, po = criar('oferecendo_vaga', BIO_CULINARIA_2)
            c = self.como(ub)
            self.assertEqual(c.patch(f'/api/perfis/{pb.id}/', {'bio': BIO_FESTAS}, format='json').status_code, 200)
            self.assertEqual(c.get('/api/descoberta/').status_code, 200)
            self.assertEqual(c.get(f'/api/perfis/{po.id}/').status_code, 200)
            r = c.get(f'/api/compatibilidade/{po.id}/')
            self.assertEqual(r.status_code, 200)
            self.assertIsNone(r.json()['afinidade_ia'])
            self.assertFalse(r.json()['ia_disponivel'])
            adm = self.como(admin())
            self.assertEqual(adm.get('/api/admin/ia/status/').status_code, 200)
            self.assertEqual(adm.post('/api/admin/ia/testar/', {'texto_a': 'a', 'texto_b': 'b'}, format='json').status_code, 503)
        self.assertFalse(EmbeddingPerfil.objects.exists())
