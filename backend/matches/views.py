from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from perfis.models import Perfil
from .models import Compatibilidade, Curtida, Match
from .serializers import PerfilDescobertoSerializer, CurtidaSerializer, MatchSerializer


def _get_perfil(user):
    try:
        return user.perfil
    except Perfil.DoesNotExist:
        return None


class DescobertaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        meu_perfil = _get_perfil(request.user)
        if meu_perfil is None:
            return Response(
                {'detail': 'Você precisa criar um perfil antes de acessar a descoberta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        meu_tipo = request.user.tipo
        if meu_tipo not in ('buscando_vaga', 'oferecendo_vaga'):
            return Response([], status=status.HTTP_200_OK)

        tipo_oposto = 'oferecendo_vaga' if meu_tipo == 'buscando_vaga' else 'buscando_vaga'

        ja_avaliados = Curtida.objects.filter(
            perfil_origem=meu_perfil,
        ).values_list('perfil_destino_id', flat=True)

        candidatos = (
            Perfil.objects
            .filter(usuario__tipo=tipo_oposto)
            .exclude(id=meu_perfil.id)
            .exclude(id__in=ja_avaliados)
            .select_related('usuario')
        )

        scores = {}
        for p in candidatos:
            pa_id = min(meu_perfil.id, p.id)
            pb_id = max(meu_perfil.id, p.id)
            try:
                compat = Compatibilidade.objects.get(perfil_a_id=pa_id, perfil_b_id=pb_id)
                scores[p.id] = round(compat.score, 4)
            except Compatibilidade.DoesNotExist:
                scores[p.id] = 0.0

        ordenados = sorted(candidatos, key=lambda p: scores.get(p.id, 0.0), reverse=True)

        serializer = PerfilDescobertoSerializer(
            ordenados,
            many=True,
            context={'scores': scores},
        )
        return Response(serializer.data)


class CurtidaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        meu_perfil = _get_perfil(request.user)
        if meu_perfil is None:
            return Response(
                {'detail': 'Você precisa criar um perfil antes de curtir.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CurtidaSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        perfil_destino = serializer.validated_data['perfil_destino']
        tipo = serializer.validated_data['tipo']

        if perfil_destino.id == meu_perfil.id:
            return Response(
                {'detail': 'Você não pode curtir o seu próprio perfil.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Curtida.objects.filter(perfil_origem=meu_perfil, perfil_destino=perfil_destino).exists():
            return Response(
                {'detail': 'Você já avaliou este perfil.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Curtida.objects.create(
            perfil_origem=meu_perfil,
            perfil_destino=perfil_destino,
            tipo=tipo,
        )

        is_match = False
        match_data = None

        if tipo == 'curtir':
            curtida_reversa = Curtida.objects.filter(
                perfil_origem=perfil_destino,
                perfil_destino=meu_perfil,
                tipo='curtir',
            ).first()

            if curtida_reversa:
                pa_id = min(meu_perfil.id, perfil_destino.id)
                pb_id = max(meu_perfil.id, perfil_destino.id)

                try:
                    compat = Compatibilidade.objects.get(perfil_a_id=pa_id, perfil_b_id=pb_id)
                    score = compat.score
                except Compatibilidade.DoesNotExist:
                    score = 0.0

                match, _ = Match.objects.get_or_create(
                    perfil_a_id=pa_id,
                    perfil_b_id=pb_id,
                    defaults={'score': score},
                )
                is_match = True
                match_data = MatchSerializer(match).data

        response_data: dict = {'match': is_match}
        if match_data:
            response_data['match_data'] = match_data

        return Response(response_data, status=status.HTTP_201_CREATED)


class MatchListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        meu_perfil = _get_perfil(request.user)
        if meu_perfil is None:
            return Response([], status=status.HTTP_200_OK)

        matches = (
            Match.objects
            .filter(Q(perfil_a=meu_perfil) | Q(perfil_b=meu_perfil))
            .select_related('perfil_a', 'perfil_b')
            .order_by('-data_match')
        )
        return Response(MatchSerializer(matches, many=True).data)
