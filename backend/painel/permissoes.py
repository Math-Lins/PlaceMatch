from rest_framework import permissions


class AdminPermission(permissions.BasePermission):
    """Permite acesso apenas a usuários com tipo == 'administrador'."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.tipo == 'administrador'
