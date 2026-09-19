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
        serializer.save(usuario=self.request.user)
