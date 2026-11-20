"""Rotas de administrador da Afinidade por IA: situação do modelo e teste com dois textos."""
import time
from collections import Counter

from django.db.models import Avg, Max
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from logs.servicos import registrar
from matches.algoritmo.afinidade import arredondar_cosseno, calibrar
from matches.algoritmo.config import (
    IA_COSSENO_PISO, IA_COSSENO_TETO, LIMIAR_TEMA, MARGEM_TEMA, MAX_TEMAS, MIN_CARACTERES_TEXTO, PESOS,
)
from painel.permissoes import AdminPermission
from perfis.models import Perfil
from placematch.api_docs import doc

from . import servico
from .explicacao import temas_em_comum
from .models import EmbeddingPerfil
from .serializers import IATestarSerializer
from .temas import TEMAS, nomes


class IAStatusView(APIView):
    permission_classes = [AdminPermission]

    @extend_schema(**doc('ia_status'))
    def get(self, request):
        modelo = servico.nome_modelo()
        validos = EmbeddingPerfil.objects.filter(modelo=modelo)
        agregados = validos.aggregate(media=Avg('tempo_ms'), ultima=Max('atualizado_em'))
        perfis = Perfil.objects.select_related('usuario').only(
            'id', 'bio', 'titulo_anuncio', 'descricao_imovel', 'usuario__tipo')
        com_texto = {p.id for p in perfis if servico.texto_suficiente(servico.texto_do_perfil(p))}
        com_embedding = set(validos.values_list('perfil_id', flat=True))
        contagem_temas = Counter(t for lista in validos.values_list('temas', flat=True) for t in (lista or []))
        est = servico.estado()
        return Response({
            'habilitada': servico.habilitada(),
            'disponivel': servico.disponivel(),
            'situacao': est['situacao'],
            'erro': est['erro'],
            'modelo': modelo,
            'dimensoes': servico.DIMENSOES,
            'modelo_baixado': servico.modelo_baixado(),
            'tempo_carregamento_ms': est['tempo_carregamento_ms'],
            'perfis_total': len(perfis),
            'perfis_com_texto_suficiente': len(com_texto),
            'perfis_com_embedding': len(com_embedding),
            'perfis_sem_embedding_com_texto': len(com_texto - com_embedding),
            'temas_cadastrados': len(TEMAS),
            'temas': [{'id': t['id'], 'nome': t['nome'], 'perfis': contagem_temas.get(t['id'], 0)} for t in TEMAS],
            'tempo_medio_geracao_ms': round(agregados['media'], 2) if agregados['media'] is not None else None,
            'ultima_atualizacao': agregados['ultima'],
            'calibracao': {
                'peso': PESOS['afinidade_ia'], 'cosseno_piso': IA_COSSENO_PISO, 'cosseno_teto': IA_COSSENO_TETO,
                'limiar_tema': LIMIAR_TEMA, 'margem_tema': MARGEM_TEMA, 'max_temas': MAX_TEMAS,
                'min_caracteres_texto': MIN_CARACTERES_TEXTO,
            },
        })


class IATestarView(APIView):
    permission_classes = [AdminPermission]

    @extend_schema(**doc('ia_testar'))
    def post(self, request):
        ser = IATestarSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        texto_a, texto_b = ser.validated_data['texto_a'], ser.validated_data['texto_b']
        detalhes = {'caracteres_a': len(texto_a), 'caracteres_b': len(texto_b)}  # os textos NÃO são gravados

        inicio = time.perf_counter()
        vetores = servico.gerar_vetores([texto_a, texto_b]) if servico.habilitada() else None
        temas = servico.temas_de_vetores(vetores) if vetores is not None else None
        if vetores is None or temas is None:
            registrar('IA_TESTE', usuario=request.user, entidade='ia', detalhes={**detalhes, 'ia_disponivel': False},
                      request=request)
            mensagem = ('A Afinidade por IA está desligada neste servidor (IA_HABILITADA=False).'
                        if not servico.habilitada() else
                        'O modelo de IA não está disponível no momento. No servidor, rode '
                        '"python manage.py baixar_modelo_ia" e tente de novo em alguns minutos.')
            return Response({'detail': mensagem}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        cos = arredondar_cosseno(vetores[0] @ vetores[1])
        afinidade = calibrar(cos)
        ms = round((time.perf_counter() - inicio) * 1000, 1)
        registrar('IA_TESTE', usuario=request.user, entidade='ia',
                  detalhes={**detalhes, 'ia_disponivel': True, 'afinidade': afinidade, 'tempo_ms': ms}, request=request)
        return Response({
            'similaridade': cos,
            'afinidade': afinidade,
            'temas_a': nomes(temas[0]),
            'temas_b': nomes(temas[1]),
            'temas_em_comum': temas_em_comum(temas[0], temas[1]),
            'tempo_ms': ms,
            'modelo': servico.nome_modelo(),
        })
