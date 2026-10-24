from datetime import date

from django.db.models import Q
from django.utils.timezone import make_aware
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from .models import LogOperacao
from .servicos import registrar
from painel.exportacao import gerar_csv_response
from painel.permissoes import AdminPermission


def _aplicar_filtros(qs, params):
    acao = params.get('acao')
    if acao:
        qs = qs.filter(acao=acao)

    usuario_id = params.get('usuario')
    if usuario_id:
        try:
            qs = qs.filter(usuario_id=int(usuario_id))
        except (ValueError, TypeError):
            pass

    entidade = params.get('entidade')
    if entidade:
        qs = qs.filter(entidade=entidade)

    data_inicio = params.get('data_inicio')
    if data_inicio:
        try:
            d = date.fromisoformat(data_inicio)
            dt = make_aware(timezone.datetime(d.year, d.month, d.day, 0, 0, 0))
            qs = qs.filter(data_hora__gte=dt)
        except (ValueError, AttributeError):
            pass

    data_fim = params.get('data_fim')
    if data_fim:
        try:
            d = date.fromisoformat(data_fim)
            dt = make_aware(timezone.datetime(d.year, d.month, d.day, 23, 59, 59))
            qs = qs.filter(data_hora__lte=dt)
        except (ValueError, AttributeError):
            pass

    q = params.get('q')
    if q:
        qs = qs.filter(
            Q(usuario__email__icontains=q)
            | Q(usuario__username__icontains=q)
            | Q(entidade__icontains=q)
        )

    return qs


def _serializar_log(log):
    usuario_data = None
    if log.usuario_id:
        usuario_data = {
            'id': log.usuario_id,
            'nome': log.usuario.get_full_name() or log.usuario.username,
            'email': log.usuario.email,
        }
    return {
        'id': log.id,
        'data_hora': log.data_hora,
        'usuario': usuario_data,
        'acao': log.acao,
        'acao_label': log.get_acao_display(),
        'entidade': log.entidade,
        'entidade_id': log.entidade_id,
        'detalhes': log.detalhes,
        'ip': log.ip,
    }


class LogListView(APIView):
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def get(self, request):
        qs = LogOperacao.objects.select_related('usuario').order_by('-data_hora', '-id')
        qs = _aplicar_filtros(qs, request.query_params)

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (ValueError, TypeError):
            page = 1

        try:
            page_size = min(100, max(1, int(request.query_params.get('page_size', 20))))
        except (ValueError, TypeError):
            page_size = 20

        count = qs.count()
        offset = (page - 1) * page_size
        logs = qs[offset:offset + page_size]

        return Response({
            'count': count,
            'page': page,
            'results': [_serializar_log(log) for log in logs],
        })


class LogExportarView(APIView):
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def get(self, request):
        qs = LogOperacao.objects.select_related('usuario').order_by('-data_hora', '-id')
        qs = _aplicar_filtros(qs, request.query_params)

        cabecalho = [
            'ID', 'Data/Hora', 'Usuário ID', 'Usuário Nome', 'Usuário E-mail',
            'Ação', 'Descrição da Ação', 'Entidade', 'ID da Entidade', 'Detalhes', 'IP',
        ]
        linhas = []
        for log in qs:
            usuario_id = log.usuario_id or ''
            usuario_nome = ''
            usuario_email = ''
            if log.usuario_id:
                usuario_nome = log.usuario.get_full_name() or log.usuario.username
                usuario_email = log.usuario.email
            linhas.append([
                log.id,
                log.data_hora.strftime('%Y-%m-%d %H:%M:%S'),
                usuario_id,
                usuario_nome,
                usuario_email,
                log.acao,
                log.get_acao_display(),
                log.entidade,
                log.entidade_id or '',
                str(log.detalhes),
                log.ip or '',
            ])

        filtros_usados = {k: v for k, v in request.query_params.items()}
        registrar(
            'RELATORIO_EXPORTADO',
            usuario=request.user,
            entidade='log',
            detalhes={'filtros': filtros_usados},
            request=request,
        )

        return gerar_csv_response(cabecalho, linhas, 'logs')
