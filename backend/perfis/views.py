from django.db.models import Q
from rest_framework import viewsets, permissions
from .models import Perfil
from .serializers import PerfilSerializer


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.usuario == request.user


# Mapa de tipo → tipo oposto (apenas usuários comuns participam da descoberta).
_TIPO_OPOSTO = {
    'buscando_vaga': 'oferecendo_vaga',
    'oferecendo_vaga': 'buscando_vaga',
}


class PerfilViewSet(viewsets.ModelViewSet):
    serializer_class = PerfilSerializer

    def get_queryset(self):
        user = self.request.user
        # Administrador enxerga todos os perfis em qualquer ação.
        if user.tipo == 'administrador':
            return Perfil.objects.all()
        # LIST retorna apenas o perfil do próprio usuário.
        if self.action == 'list':
            return Perfil.objects.filter(usuario=user)
        # Demais ações (retrieve, update, destroy) recebem queryset completo;
        # get_object() aplica as restrições de acesso adicionais.
        return Perfil.objects.all()

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsOwner()]

    def get_object(self):
        obj = super().get_object()  # já chama check_object_permissions (IsOwner para write)

        # Para retrieve, restringe por: próprio perfil, tipo oposto, match ou admin.
        if self.action == 'retrieve':
            user = self.request.user
            if user.tipo == 'administrador':
                return obj
            if obj.usuario == user:
                return obj
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
        perfil = serializer.save(usuario=self.request.user)
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
