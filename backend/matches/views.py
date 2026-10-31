from decimal import Decimal, InvalidOperation

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


def _parse_bool_param(val, campo):
    """Converte 'true'/'false' para bool. Retorna (bool|None, erro|None)."""
    if val is None:
        return None, None
    if val.lower() == 'true':
        return True, None
    if val.lower() == 'false':
        return False, None
    return None, Response(
        {'detail': f'Valor inválido para {campo}. Use true ou false.'},
        status=status.HTTP_400_BAD_REQUEST,
    )


def _parse_decimal_param(val, campo):
    """Converte string para Decimal. Retorna (Decimal|None, erro|None)."""
    if val is None:
        return None, None
    try:
        return Decimal(val), None
    except (InvalidOperation, ValueError, TypeError):
        return None, Response(
            {'detail': f'Valor inválido para {campo}. Informe um número.'},
            status=status.HTTP_400_BAD_REQUEST,
        )


def _parse_score_min(val):
    """Converte score_min (0-100%) para float 0-1. Retorna (float|None, erro|None)."""
    if val is None:
        return None, None
    try:
        v = float(val)
        if not 0.0 <= v <= 100.0:
            raise ValueError
        return v / 100.0, None
    except (ValueError, TypeError):
        return None, Response(
            {'detail': 'score_min deve ser um número entre 0 e 100.'},
            status=status.HTTP_400_BAD_REQUEST,
        )


_ORDENAR_CHOICES = ('score', 'orcamento_asc', 'orcamento_desc')


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

        # ── Validar parâmetros de filtro ──────────────────────────────────────
        params = request.query_params

        aceita_pets, erro = _parse_bool_param(params.get('aceita_pets'), 'aceita_pets')
        if erro:
            return erro
        fumante, erro = _parse_bool_param(params.get('fumante'), 'fumante')
        if erro:
            return erro
        orc_min, erro = _parse_decimal_param(params.get('orcamento_min'), 'orcamento_min')
        if erro:
            return erro
        orc_max, erro = _parse_decimal_param(params.get('orcamento_max'), 'orcamento_max')
        if erro:
            return erro
        score_min_val, erro = _parse_score_min(params.get('score_min'))
        if erro:
            return erro

        ordenar = params.get('ordenar', 'score')
        if ordenar not in _ORDENAR_CHOICES:
            return Response(
                {'detail': f'ordenar inválido. Use: {", ".join(_ORDENAR_CHOICES)}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tipo_oposto = 'oferecendo_vaga' if meu_tipo == 'buscando_vaga' else 'buscando_vaga'

        ja_avaliados = Curtida.objects.filter(
            perfil_origem=meu_perfil,
        ).values_list('perfil_destino_id', flat=True)

        # Bug-fix: excluir perfis que já têm match com o usuário, mesmo quando
        # não há Curtida registrada (ex.: match criado administrativamente).
        ja_matches_pares = Match.objects.filter(
            Q(perfil_a=meu_perfil) | Q(perfil_b=meu_perfil)
        ).values_list('perfil_a_id', 'perfil_b_id')
        ja_matches_ids = {pid for par in ja_matches_pares for pid in par} - {meu_perfil.id}

        candidatos = (
            Perfil.objects
            .filter(usuario__tipo=tipo_oposto, usuario__is_active=True)
            .exclude(id=meu_perfil.id)
            .exclude(id__in=ja_avaliados)
            .exclude(id__in=ja_matches_ids)
            .select_related('usuario')
        )

        # ── Aplicar filtros opcionais ─────────────────────────────────────────
        q = params.get('q')
        if q:
            candidatos = candidatos.filter(
                Q(nome__icontains=q)
                | Q(regiao__icontains=q)
                | Q(titulo_anuncio__icontains=q)
            )

        regioes = params.getlist('regiao')
        if regioes:
            candidatos = candidatos.filter(regiao__in=regioes)

        tipo_imovel = params.get('tipo_imovel')
        if tipo_imovel:
            candidatos = candidatos.filter(tipo_imovel=tipo_imovel)

        if aceita_pets is not None:
            candidatos = candidatos.filter(aceita_pets=aceita_pets)

        if fumante is not None:
            candidatos = candidatos.filter(fumante=fumante)

        # Interseção de faixas de orçamento:
        # A faixa do perfil [orcamento_min, orcamento_max] intersecta [orc_min, orc_max]
        # quando perfil.orcamento_max >= orc_min E perfil.orcamento_min <= orc_max.
        if orc_min is not None:
            candidatos = candidatos.filter(orcamento_max__gte=orc_min)
        if orc_max is not None:
            candidatos = candidatos.filter(orcamento_min__lte=orc_max)

        # ── Calcular scores ───────────────────────────────────────────────────
        candidatos_lista = list(candidatos)
        scores = {}
        for p in candidatos_lista:
            pa_id = min(meu_perfil.id, p.id)
            pb_id = max(meu_perfil.id, p.id)
            try:
                compat = Compatibilidade.objects.get(perfil_a_id=pa_id, perfil_b_id=pb_id)
                scores[p.id] = round(compat.score, 4)
            except Compatibilidade.DoesNotExist:
                scores[p.id] = 0.0

        # ── Filtro por score mínimo ───────────────────────────────────────────
        if score_min_val is not None:
            candidatos_lista = [
                p for p in candidatos_lista
                if scores.get(p.id, 0.0) >= score_min_val
            ]

        # ── Ordenação ─────────────────────────────────────────────────────────
        if ordenar == 'orcamento_asc':
            ordenados = sorted(candidatos_lista, key=lambda p: p.orcamento_min)
        elif ordenar == 'orcamento_desc':
            ordenados = sorted(candidatos_lista, key=lambda p: p.orcamento_min, reverse=True)
        else:
            ordenados = sorted(
                candidatos_lista, key=lambda p: scores.get(p.id, 0.0), reverse=True
            )

        serializer = PerfilDescobertoSerializer(
            ordenados,
            many=True,
            context={'scores': scores},
        )
        return Response(serializer.data)


class CurtidaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.tipo == 'administrador':
            return Response(
                {'detail': 'Administradores não podem avaliar perfis.'},
                status=status.HTTP_403_FORBIDDEN,
            )

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

        if perfil_destino.usuario.tipo == request.user.tipo:
            return Response(
                {'detail': 'Você só pode avaliar perfis do tipo oposto.'},
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

        from logs.servicos import registrar
        acao_log = 'CURTIDA' if tipo == 'curtir' else 'RECUSA'
        registrar(
            acao_log,
            usuario=request.user,
            entidade='perfil',
            entidade_id=perfil_destino.id,
            request=request,
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

                match, created = Match.objects.get_or_create(
                    perfil_a_id=pa_id,
                    perfil_b_id=pb_id,
                    defaults={'score': score},
                )
                if created:
                    registrar(
                        'MATCH_CRIADO',
                        usuario=request.user,
                        entidade='match',
                        entidade_id=match.id,
                        detalhes={'match_id': match.id, 'score': round(score, 4)},
                        request=request,
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
            .filter(perfil_a__usuario__is_active=True, perfil_b__usuario__is_active=True)
            .select_related('perfil_a', 'perfil_b')
            .order_by('-score', '-data_match')
        )
        return Response(MatchSerializer(matches, many=True).data)
