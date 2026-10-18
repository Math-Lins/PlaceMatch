from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from perfis.models import Perfil
from matches.models import Match
from .models import Mensagem
from .serializers import MensagemSerializer


def _get_perfil(user):
    try:
        return user.perfil
    except Perfil.DoesNotExist:
        return None


class ConversasView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        meu_perfil = _get_perfil(request.user)
        if meu_perfil is None:
            return Response([], status=status.HTTP_200_OK)

        matches = (
            Match.objects
            .filter(Q(perfil_a=meu_perfil) | Q(perfil_b=meu_perfil))
            .select_related('perfil_a', 'perfil_a__usuario', 'perfil_b', 'perfil_b__usuario')
        )

        resultado = []
        for match in matches:
            outro = match.perfil_b if match.perfil_a_id == meu_perfil.id else match.perfil_a
            outro_id = outro.id

            ultima = match.mensagens.order_by('-data_envio', '-id').first()
            nao_lidas = match.mensagens.filter(remetente_id=outro_id, lida=False).count()
            sort_key = ultima.data_envio if ultima else match.data_match

            resultado.append({
                'match_id': match.id,
                'outro_perfil': {
                    'id': outro.id,
                    'nome': outro.nome,
                    'idade': outro.idade,
                    'regiao': outro.regiao,
                    'tipo': outro.usuario.tipo,
                    'titulo_anuncio': outro.titulo_anuncio,
                    'descricao_imovel': outro.descricao_imovel,
                    'fotos_imovel': outro.fotos_imovel,
                    'foto_perfil_url': outro.foto_perfil_url,
                    'tipo_imovel': outro.tipo_imovel,
                    'qtd_moradores': outro.qtd_moradores,
                    'orcamento_min': str(outro.orcamento_min),
                    'orcamento_max': str(outro.orcamento_max),
                    'aceita_pets': outro.aceita_pets,
                    'fumante': outro.fumante,
                },
                'score': match.score,
                'ultima_mensagem': {
                    'conteudo': ultima.conteudo,
                    'data_envio': ultima.data_envio,
                    'remetente_id': ultima.remetente_id,
                } if ultima else None,
                'nao_lidas': nao_lidas,
                '_sort': sort_key,
            })

        resultado.sort(key=lambda x: x.pop('_sort'), reverse=True)
        return Response(resultado)


class MensagensView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _verificar_participacao(self, request, match_id):
        """
        Retorna (match, meu_perfil, outro_id) ou (None, Response de erro, None).
        """
        try:
            match = Match.objects.get(id=match_id)
        except Match.DoesNotExist:
            return None, Response(
                {'detail': 'Match não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            ), None

        meu_perfil = _get_perfil(request.user)
        if meu_perfil is None:
            return None, Response(
                {'detail': 'Você precisa criar um perfil antes de acessar o chat.'},
                status=status.HTTP_400_BAD_REQUEST,
            ), None

        if meu_perfil.id not in (match.perfil_a_id, match.perfil_b_id):
            return None, Response(
                {'detail': 'Você não tem acesso a este match.'},
                status=status.HTTP_403_FORBIDDEN,
            ), None

        outro_id = match.perfil_b_id if match.perfil_a_id == meu_perfil.id else match.perfil_a_id
        return match, meu_perfil, outro_id

    def get(self, request, match_id):
        match, meu_perfil_ou_erro, outro_id = self._verificar_participacao(request, match_id)
        if match is None:
            return meu_perfil_ou_erro

        # Marca como lidas as mensagens do outro participante
        match.mensagens.filter(remetente_id=outro_id, lida=False).update(lida=True)

        qs = match.mensagens.all()

        apos = request.query_params.get('apos')
        if apos is not None:
            try:
                qs = qs.filter(id__gt=int(apos))
            except (ValueError, TypeError):
                pass

        return Response(MensagemSerializer(qs, many=True).data)

    def post(self, request, match_id):
        match, meu_perfil_ou_erro, _ = self._verificar_participacao(request, match_id)
        if match is None:
            return meu_perfil_ou_erro

        meu_perfil = meu_perfil_ou_erro
        conteudo = request.data.get('conteudo', '')

        if not conteudo or not str(conteudo).strip():
            return Response(
                {'detail': 'O conteúdo da mensagem não pode ser vazio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(str(conteudo)) > 1000:
            return Response(
                {'detail': 'O conteúdo da mensagem não pode ter mais de 1000 caracteres.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mensagem = Mensagem.objects.create(
            match=match,
            remetente=meu_perfil,
            conteudo=conteudo,
        )
        return Response(MensagemSerializer(mensagem).data, status=status.HTTP_201_CREATED)
