from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from painel.permissoes import AdminPermission
from .models import Denuncia
from .servicos import criar_denuncia, resolver_denuncia, suspender_usuario, reativar_usuario


User = get_user_model()


# ─── Usuário comum ────────────────────────────────────────────────────────────

class DenunciaCreateView(APIView):
    """POST /api/moderacao/denuncias/ — qualquer usuário autenticado (não-admin)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        denunciado_id = request.data.get('denunciado')
        motivo = request.data.get('motivo', '')
        descricao = request.data.get('descricao', '')

        if not denunciado_id:
            return Response(
                {'detail': 'O campo "denunciado" é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            denuncia = criar_denuncia(
                denunciante=request.user,
                denunciado_id=denunciado_id,
                motivo=motivo,
                descricao=descricao,
                request=request,
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'id': denuncia.id,
                'denunciado': denuncia.denunciado_id,
                'motivo': denuncia.motivo,
                'status': denuncia.status,
                'criada_em': denuncia.criada_em,
            },
            status=status.HTTP_201_CREATED,
        )


# ─── Admin ────────────────────────────────────────────────────────────────────

class AdminDenunciaListView(APIView):
    """GET /api/admin/moderacao/denuncias/ — lista com filtros opcionais."""
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def get(self, request):
        qs = Denuncia.objects.select_related('denunciante', 'denunciado', 'resolvida_por')

        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        denunciado_id = request.query_params.get('denunciado')
        if denunciado_id:
            qs = qs.filter(denunciado_id=denunciado_id)

        motivo = request.query_params.get('motivo')
        if motivo:
            qs = qs.filter(motivo=motivo)

        resultado = []
        for d in qs:
            resultado.append({
                'id': d.id,
                'denunciante': {
                    'id': d.denunciante_id,
                    'email': d.denunciante.email if d.denunciante else None,
                },
                'denunciado': {
                    'id': d.denunciado_id,
                    'email': d.denunciado.email,
                },
                'motivo': d.motivo,
                'motivo_display': d.get_motivo_display(),
                'descricao': d.descricao,
                'status': d.status,
                'resolvida_por': d.resolvida_por.email if d.resolvida_por else None,
                'resolucao': d.resolucao,
                'criada_em': d.criada_em,
                'atualizada_em': d.atualizada_em,
            })

        return Response(resultado)


class AdminDenunciaResolverView(APIView):
    """PATCH /api/admin/moderacao/denuncias/<id>/ — resolve ou descarta."""
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def patch(self, request, denuncia_id):
        try:
            denuncia = Denuncia.objects.get(id=denuncia_id)
        except Denuncia.DoesNotExist:
            return Response(
                {'detail': 'Denúncia não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        novo_status = request.data.get('status')
        resolucao = request.data.get('resolucao', '')

        try:
            resolver_denuncia(denuncia, request.user, novo_status, resolucao, request)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'id': denuncia.id,
            'status': denuncia.status,
            'resolucao': denuncia.resolucao,
            'resolvida_por': request.user.email,
        })


class AdminSuspenderUsuarioView(APIView):
    """POST /api/admin/moderacao/usuarios/<id>/suspender/"""
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def post(self, request, usuario_id):
        try:
            usuario = User.objects.get(id=usuario_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Usuário não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        motivo = request.data.get('motivo', '')

        try:
            suspender_usuario(usuario, request.user, motivo, request)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'id': usuario.id,
            'email': usuario.email,
            'ativo': usuario.is_active,
        })


class AdminReativarUsuarioView(APIView):
    """POST /api/admin/moderacao/usuarios/<id>/reativar/"""
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def post(self, request, usuario_id):
        try:
            usuario = User.objects.get(id=usuario_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Usuário não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            reativar_usuario(usuario, request.user, request)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'id': usuario.id,
            'email': usuario.email,
            'ativo': usuario.is_active,
        })
