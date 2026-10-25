from rest_framework import viewsets, permissions
from .models import Perfil
from .serializers import PerfilSerializer


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.usuario == request.user


class PerfilViewSet(viewsets.ModelViewSet):
    serializer_class = PerfilSerializer

    def get_queryset(self):
        return Perfil.objects.all()

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsOwner()]

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
