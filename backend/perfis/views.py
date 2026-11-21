from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import viewsets, permissions
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from .models import Perfil
from .serializers import PerfilDetalheSerializer, PerfilSerializer
from drf_spectacular.utils import extend_schema, extend_schema_view
from placematch.api_docs import doc


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.usuario == request.user


class NaoAdministradorNaCriacao(permissions.BasePermission):
    """O administrador não participa do matching: não cria perfil."""
    message = 'O administrador não participa deste recurso.'

    def has_permission(self, request, view):
        if request.method == 'POST' and request.user.tipo == 'administrador':
            return False
        return True


def _perfil_do_usuario(user):
    if getattr(user, 'tipo', '') == 'administrador':
        return None
    try:
        return Perfil.objects.select_related('embedding_ia').get(usuario=user)
    except Perfil.DoesNotExist:
        return None


# Mapa de tipo → tipo oposto (apenas usuários comuns participam da descoberta).
_TIPO_OPOSTO = {
    'buscando_vaga': 'oferecendo_vaga',
    'oferecendo_vaga': 'buscando_vaga',
}


@extend_schema_view(
    list=extend_schema(**doc('perfis_listar')),
    create=extend_schema(**doc('perfis_criar')),
    retrieve=extend_schema(**doc('perfis_consultar')),
    update=extend_schema(**doc('perfis_atualizar')),
    partial_update=extend_schema(**doc('perfis_atualizar_parcial')),
    destroy=extend_schema(**doc('perfis_excluir')),
)
class PerfilViewSet(viewsets.ModelViewSet):
    serializer_class = PerfilSerializer
    queryset = Perfil.objects.none()  # o queryset real depende do usuário (get_queryset); isto só alimenta o schema

    def get_queryset(self):
        user = self.request.user
        # Administrador enxerga todos os perfis em qualquer ação.
        if user.tipo == 'administrador':
            return Perfil.objects.all()
        # LIST retorna apenas o perfil do próprio usuário.
        if self.action == 'list':
            return Perfil.objects.filter(usuario=user).select_related('usuario', 'embedding_ia')  # analise_ia sem consultas extras
        # Demais ações (retrieve, update, destroy) recebem queryset completo;
        # get_object() aplica as restrições de acesso adicionais.
        return Perfil.objects.all()

    def retrieve(self, request, *args, **kwargs):
        """Perfil + afinidade_ia e temas_em_comum com o perfil do usuário logado (null/[] no próprio perfil e para o admin)."""
        obj = self.get_object()
        contexto = self.get_serializer_context()
        meu = _perfil_do_usuario(request.user)
        if meu is not None and meu.pk != obj.pk and obj.usuario.tipo == _TIPO_OPOSTO.get(request.user.tipo):
            from ia.explicacao import afinidades_para
            contexto['ia'] = afinidades_para(meu, [obj])
        return Response(PerfilDetalheSerializer(obj, context=contexto).data)

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), NaoAdministradorNaCriacao(), IsOwner()]

    def get_object(self):
        obj = super().get_object()  # já chama check_object_permissions (IsOwner para write)

        # Para retrieve, restringe por: próprio perfil, tipo oposto, match ou admin.
        if self.action == 'retrieve':
            user = self.request.user
            if user.tipo == 'administrador':
                return obj
            if obj.usuario == user:
                return obj
            # Conta suspensa não aparece para os outros usuários (a Descoberta também a esconde).
            if not obj.usuario.is_active:
                raise NotFound('Perfil não encontrado.')
            # Perfil de tipo oposto (visível na Descoberta).
            if obj.usuario.tipo == _TIPO_OPOSTO.get(user.tipo):
                return obj
            # Perfil de participante de um match do usuário.
            try:
                from matches.models import Match
                meu_perfil = user.perfil
                em_match = Match.objects.filter(
                    Q(perfil_a=meu_perfil, perfil_b=obj)
                    | Q(perfil_a=obj, perfil_b=meu_perfil)
                ).exists()
                if em_match:
                    return obj
            except Perfil.DoesNotExist:
                pass
            self.permission_denied(
                self.request,
                message='Você não tem permissão para acessar este perfil.',
            )

        return obj

    def perform_create(self, serializer):
        from logs.servicos import registrar
        if Perfil.objects.filter(usuario=self.request.user).exists():
            raise ValidationError({'detail': 'Você já possui um perfil.'})
        try:
            with transaction.atomic():
                perfil = serializer.save(usuario=self.request.user)
        except IntegrityError:
            raise ValidationError({'detail': 'Você já possui um perfil.'})
        registrar(
            'PERFIL_CRIADO',
            usuario=self.request.user,
            entidade='perfil',
            entidade_id=perfil.id,
            request=self.request,
        )

    def perform_update(self, serializer):
        from logs.servicos import registrar
        campos_alterados = list(serializer.validated_data.keys())
        perfil = serializer.save()
        registrar(
            'PERFIL_EDITADO',
            usuario=self.request.user,
            entidade='perfil',
            entidade_id=perfil.id,
            detalhes={'campos': campos_alterados},
            request=self.request,
        )

    def perform_destroy(self, instance):
        from logs.servicos import registrar
        perfil_id = instance.id
        registrar(
            'PERFIL_EXCLUIDO',
            usuario=self.request.user,
            entidade='perfil',
            entidade_id=perfil_id,
            request=self.request,
        )
        instance.delete()
