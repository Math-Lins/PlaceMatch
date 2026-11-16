"""Permissões compartilhadas."""
from django.conf import settings
from rest_framework.permissions import BasePermission


class PermissaoDocs(BasePermission):
    """Documentação da API (/api/schema/ e /api/docs/).

    - Em desenvolvimento (DEBUG=True): aberta a todos.
    - Em produção (DEBUG=False): somente administrador logado (tipo `administrador` ou `is_staff`),
      por sessão do Django (login em /admin/) ou por token JWT no cabeçalho.
    """
    message = 'A documentação da API é restrita a administradores.'

    def has_permission(self, request, view):
        if settings.DEBUG:
            return True
        u = request.user
        return bool(u and u.is_authenticated and (u.is_staff or getattr(u, 'tipo', '') == 'administrador'))
