"""Comandos baixar_modelo_ia, gerar_embeddings e o aviso novo do verificar_banco."""
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from ia import servico
from ia.models import EmbeddingPerfil

from .apoio import BIO_CULINARIA, BIO_CURTA, BIO_FESTAS, BaseIA, criar


def _rodar(*args, **kw):
    saida = StringIO()
    call_command(*args, stdout=saida, **kw)
    return saida.getvalue()


class GerarEmbeddingsTest(BaseIA):
    def setUp(self):
        super().setUp()
        _, self.a = criar('buscando_vaga', BIO_CULINARIA)
        _, self.b = criar('oferecendo_vaga', BIO_FESTAS)
        _, self.c = criar('oferecendo_vaga', BIO_CURTA)
        EmbeddingPerfil.objects.all().delete()

    def test_gera_para_todos_com_progresso_tempo_e_recalculo(self):
        saida = _rodar('gerar_embeddings', '--lote', '2')
        self.assertEqual(EmbeddingPerfil.objects.count(), 2)
        self.assertIn('2/3 perfis', saida)
        self.assertIn('3/3 perfis', saida)
        self.assertIn('2 criados', saida)
        self.assertIn('1 sem bio suficiente', saida)
        self.assertIn('Tempo:', saida)
        self.assertIn('Recalculando compatibilidades', saida)

    def test_sem_forcar_so_processa_o_que_mudou_e_com_forcar_regera(self):
        _rodar('gerar_embeddings', '--sem-recalcular')
        self.assertIn('2 sem mudança', _rodar('gerar_embeddings', '--sem-recalcular'))
        self.assertIn('2 atualizados', _rodar('gerar_embeddings', '--forcar', '--sem-recalcular'))

    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada(self):
        with self.assertRaisesMessage(CommandError, 'desligada'):
            _rodar('gerar_embeddings')

    def test_modelo_indisponivel(self):
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('sem rede')), self.assertLogs('ia.servico'), \
                self.assertRaisesMessage(CommandError, 'baixar_modelo_ia'):
            servico.reiniciar()  # o setUp já tinha carregado o embedder falso
            _rodar('gerar_embeddings')


class BaixarModeloTest(BaseIA):
    def test_embedder_falso_nao_baixa_nada(self):
        self.assertIn('nada a baixar', _rodar('baixar_modelo_ia'))

    @override_settings(IA_EMBEDDER='fastembed')
    def test_falha_no_download_vira_erro_do_comando(self):
        with mock.patch.object(servico, 'EmbedderFastembed', side_effect=OSError('sem internet')), self.assertLogs('ia.servico'), \
                self.assertRaisesMessage(CommandError, 'sem internet'):
            _rodar('baixar_modelo_ia')

    @override_settings(IA_EMBEDDER='fastembed')
    def test_sucesso_mostra_tempo_tamanho_e_teste(self):
        with mock.patch.object(servico, 'EmbedderFastembed', side_effect=lambda pasta, apenas_local: servico.EmbedderFalso()):
            saida = _rodar('baixar_modelo_ia')
        self.assertIn('Tamanho em disco', saida)
        self.assertIn('cosseno', saida)
        self.assertIn('Modelo pronto', saida)

    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada(self):
        with self.assertRaisesMessage(CommandError, 'desligada'):
            _rodar('baixar_modelo_ia')


class VerificarBancoTest(BaseIA):
    def test_aviso_de_perfis_com_bio_sem_embedding(self):
        _, p = criar('buscando_vaga', BIO_CULINARIA)
        criar('oferecendo_vaga', BIO_CURTA)
        self.assertIn('Perfis com bio suficiente sem embedding (Afinidade por IA): 0', _rodar('verificar_banco'))
        EmbeddingPerfil.objects.filter(perfil=p).delete()
        saida = _rodar('verificar_banco', '--detalhes')
        self.assertIn('[AVISO]', saida)
        self.assertIn('Perfis com bio suficiente sem embedding (Afinidade por IA): 1', saida)
        self.assertIn(f'ids/itens: {p.id}', saida)
        self.assertIn('gerar_embeddings', saida)
        self.assertIn('embeddings_ia=0', saida)
