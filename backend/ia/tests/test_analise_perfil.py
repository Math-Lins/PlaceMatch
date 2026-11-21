"""Campo `analise_ia` do perfil: os temas que a IA encontrou na bio do PRÓPRIO usuário (tela Meu Perfil)."""
from unittest import mock

from django.test import override_settings

from ia import servico
from ia.models import EmbeddingPerfil

from .apoio import BIO_CULINARIA, BIO_CURTA, BIO_FESTAS, BaseIA, admin, criar


class AnaliseIATest(BaseIA):
    def _meu(self, usuario):
        r = self.como(usuario).get('/api/perfis/')
        self.assertEqual(r.status_code, 200)
        return r.data[0]['analise_ia']

    def test_bio_analisada_traz_os_temas(self):
        u, p = criar('buscando_vaga', BIO_CULINARIA)
        a = self._meu(u)
        self.assertEqual(a['situacao'], 'analisada')
        self.assertEqual(a['minimo_caracteres'], 20)
        self.assertGreaterEqual(a['caracteres_uteis'], 20)
        esperados = EmbeddingPerfil.objects.get(perfil=p).temas
        self.assertEqual([t['id'] for t in a['temas']], esperados)
        self.assertTrue(all(set(t) == {'id', 'nome'} for t in a['temas']))

    def test_bio_curta(self):
        u, _ = criar('buscando_vaga', BIO_CURTA)
        a = self._meu(u)
        self.assertEqual((a['situacao'], a['temas']), ('bio_curta', []))
        self.assertLess(a['caracteres_uteis'], 20)

    def test_anuncio_conta_no_texto_de_quem_oferece_vaga(self):
        u, _ = criar('oferecendo_vaga', BIO_CURTA, titulo_anuncio='Quarto silencioso perto da faculdade',
                     descricao_imovel='Casa tranquila, ideal para estudar.')
        self.assertEqual(self._meu(u)['situacao'], 'analisada')

    def test_ia_indisponivel_quando_a_bio_foi_salva_fica_pendente(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('sem rede')), self.assertLogs('ia.servico'):
            servico.reiniciar()
            u, _ = criar('buscando_vaga', BIO_FESTAS)
        self.assertEqual(self._meu(u)['situacao'], 'pendente')

    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada(self):
        u, _ = criar('buscando_vaga', BIO_CULINARIA)
        self.assertEqual(self._meu(u)['situacao'], 'ia_desligada')

    def test_atualizar_a_bio_devolve_a_analise_nova(self):
        u, p = criar('buscando_vaga', BIO_CURTA)
        r = self.como(u).patch(f'/api/perfis/{p.id}/', {'bio': BIO_CULINARIA}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['analise_ia']['situacao'], 'analisada')
        r = self.como(u).patch(f'/api/perfis/{p.id}/', {'bio': BIO_CURTA}, format='json')
        self.assertEqual(r.data['analise_ia']['situacao'], 'bio_curta')

    def test_perfil_de_outra_pessoa_nao_expoe_a_analise(self):
        u, _ = criar('buscando_vaga', BIO_CULINARIA)
        _, outro = criar('oferecendo_vaga', BIO_FESTAS)
        r = self.como(u).get(f'/api/perfis/{outro.id}/')
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data['analise_ia'])
        r = self.como(admin()).get(f'/api/perfis/{outro.id}/')
        self.assertIsNone(r.data['analise_ia'])

    def test_listar_sem_consultas_extras(self):
        u, _ = criar('buscando_vaga', BIO_CULINARIA)
        self.como(u)
        with self.assertNumQueries(1):  # perfil + usuário + embedding numa consulta só (autenticação forçada)
            self.client.get('/api/perfis/')
