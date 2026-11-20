"""Signal do Perfil: embedding gerado/atualizado só quando o texto muda, e recálculo da compatibilidade."""
from unittest import mock

import numpy as np
from django.test import override_settings

from ia import embeddings, servico
from ia.models import BYTES_VETOR, EmbeddingPerfil
from matches.algoritmo import calcular_score
from matches.models import Compatibilidade
from perfis.models import Perfil

from .apoio import BIO_CULINARIA, BIO_CULINARIA_2, BIO_CURTA, BIO_FESTAS, BaseIA, criar


def _score(a, b):
    pa, pb = sorted([a, b], key=lambda p: p.id)
    return Compatibilidade.objects.get(perfil_a=pa, perfil_b=pb).score


class SinalEmbeddingTest(BaseIA):
    def test_criar_perfil_gera_embedding_compacto_com_hash_e_temas(self):
        _, p = criar(bio=BIO_CULINARIA)
        emb = EmbeddingPerfil.objects.get(perfil=p)
        self.assertEqual(len(bytes(emb.vetor)), BYTES_VETOR)
        self.assertEqual(emb.modelo, servico.MODELO_FALSO)
        self.assertEqual(emb.hash_texto, servico.hash_texto(BIO_CULINARIA))
        self.assertIn('culinaria', emb.temas)
        self.assertGreaterEqual(emb.tempo_ms, 0)
        self.assertAlmostEqual(float(np.linalg.norm(emb.vetor_np())), 1.0, places=5)

    def test_salvar_sem_mudar_o_texto_nao_regera(self):
        _, p = criar(bio=BIO_CULINARIA)
        with mock.patch.object(servico, 'gerar_vetores', wraps=servico.gerar_vetores) as gerar:
            p.idade = 30
            p.save()
            p.regiao = 'Olinda'
            p.save()
        self.assertEqual(gerar.call_count, 0)

    def test_mudar_a_bio_regera(self):
        _, p = criar(bio=BIO_CULINARIA)
        antes = EmbeddingPerfil.objects.get(perfil=p)
        p.bio = BIO_FESTAS
        p.save()
        depois = EmbeddingPerfil.objects.get(perfil=p)
        self.assertEqual(depois.pk, antes.pk)  # atualiza o mesmo registro
        self.assertEqual(depois.hash_texto, servico.hash_texto(BIO_FESTAS))
        self.assertNotEqual(bytes(depois.vetor), bytes(antes.vetor))
        self.assertIn('festas', depois.temas)

    def test_bio_curta_nao_gera_e_encurtar_remove(self):
        _, curta = criar(bio=BIO_CURTA)
        self.assertFalse(EmbeddingPerfil.objects.filter(perfil=curta).exists())
        _, p = criar(bio=BIO_CULINARIA)
        p.bio = BIO_CURTA
        p.save()
        self.assertFalse(EmbeddingPerfil.objects.filter(perfil=p).exists())

    def test_anuncio_entra_no_texto_de_quem_oferece_vaga(self):
        _, p = criar(tipo='oferecendo_vaga', bio='', titulo_anuncio='Quarto amplo perto da praia',
                     descricao_imovel='Apartamento mobiliado com varanda e cozinha equipada.')
        emb = EmbeddingPerfil.objects.get(perfil=p)
        p.descricao_imovel = 'Casa com quintal e jardim.'
        p.save()
        self.assertNotEqual(EmbeddingPerfil.objects.get(perfil=p).hash_texto, emb.hash_texto)

    def test_compatibilidade_recalculada_usa_a_afinidade(self):
        _, a = criar('buscando_vaga', BIO_CULINARIA)
        _, b = criar('oferecendo_vaga', BIO_CULINARIA_2)
        _, c = criar('oferecendo_vaga', BIO_FESTAS)
        a = Perfil.objects.select_related('embedding_ia').get(pk=a.pk)
        self.assertGreater(_score(a, b), _score(a, c))  # tudo igual, menos a bio
        self.assertEqual(_score(a, b), calcular_score(a, Perfil.objects.get(pk=b.pk)))

    def test_editar_a_bio_atualiza_o_score(self):
        _, a = criar('buscando_vaga', BIO_CULINARIA)
        _, b = criar('oferecendo_vaga', BIO_FESTAS)
        antes = _score(a, b)
        b.bio = BIO_CULINARIA_2
        b.save()
        self.assertGreater(_score(a, b), antes)

    def test_sem_embedding_o_score_e_renormalizado(self):
        _, a = criar('buscando_vaga', BIO_CURTA)
        _, b = criar('oferecendo_vaga', BIO_FESTAS)
        self.assertEqual(_score(a, b), 1.0)  # perfis idênticos nos 6 critérios: não perde os 10% da IA


class SinalSemIATest(BaseIA):
    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada_nao_gera_e_nao_quebra(self):
        _, a = criar('buscando_vaga', BIO_CULINARIA)
        _, b = criar('oferecendo_vaga', BIO_FESTAS)
        self.assertFalse(EmbeddingPerfil.objects.exists())
        self.assertEqual(_score(a, b), 1.0)

    def test_modelo_indisponivel_salva_o_perfil_e_apaga_vetor_velho(self):
        _, p = criar(bio=BIO_CULINARIA)
        with mock.patch.object(servico, '_criar_embedder', side_effect=OSError('sem internet')), \
                self.assertLogs('ia.servico', level='WARNING'):
            servico.reiniciar()
            p.bio = BIO_FESTAS
            p.save()
            self.assertEqual(embeddings.atualizar_embedding_perfil(p), embeddings.INDISPONIVEL)
        self.assertEqual(Perfil.objects.get(pk=p.pk).bio, BIO_FESTAS)
        self.assertFalse(EmbeddingPerfil.objects.filter(perfil=p).exists())  # o vetor da bio antiga não vale mais

    def test_modelo_indisponivel_mantem_vetor_se_o_texto_nao_mudou(self):
        _, p = criar(bio=BIO_CULINARIA)
        with mock.patch.object(servico, 'gerar_vetores', return_value=None):
            self.assertEqual(embeddings.atualizar_embedding_perfil(p, forcar=True), embeddings.INDISPONIVEL)
        self.assertTrue(EmbeddingPerfil.objects.filter(perfil=p).exists())

    def test_excecao_inesperada_vira_log(self):
        _, p = criar(bio=BIO_CULINARIA)
        with mock.patch.object(embeddings, '_atualizar_lote', side_effect=RuntimeError('bug')), \
                self.assertLogs('ia.embeddings', level='ERROR'):
            self.assertEqual(embeddings.atualizar_embedding_perfil(p), embeddings.ERRO)
            p.save()  # o signal segue para o recálculo

    def test_vetor_de_outro_modelo_e_ignorado_e_regerado(self):
        _, a = criar('buscando_vaga', BIO_CULINARIA)
        EmbeddingPerfil.objects.filter(perfil=a).update(modelo='modelo-antigo')
        a = Perfil.objects.select_related('embedding_ia').get(pk=a.pk)
        self.assertIsNone(a.embedding_ia.vetor_valido())
        self.assertEqual(embeddings.atualizar_embedding_perfil(a), embeddings.ATUALIZADO)
        self.assertEqual(EmbeddingPerfil.objects.get(perfil=a).modelo, servico.MODELO_FALSO)

    def test_excluir_o_perfil_apaga_o_embedding(self):
        _, p = criar(bio=BIO_CULINARIA)
        p.delete()
        self.assertFalse(EmbeddingPerfil.objects.exists())
