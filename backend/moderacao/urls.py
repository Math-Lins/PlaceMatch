from django.urls import path
from .views import (
    DenunciaCreateView,
    AdminDenunciaListView,
    AdminDenunciaResolverView,
    AdminSuspenderUsuarioView,
    AdminReativarUsuarioView,
)

urlpatterns = [
    # Usuário comum
    path('moderacao/denuncias/', DenunciaCreateView.as_view(), name='denuncia-criar'),

    # Admin — denúncias
    path('admin/moderacao/denuncias/', AdminDenunciaListView.as_view(), name='admin-denuncia-lista'),
    path('admin/moderacao/denuncias/<int:denuncia_id>/', AdminDenunciaResolverView.as_view(), name='admin-denuncia-resolver'),

    # Admin — usuários
    path('admin/moderacao/usuarios/<int:usuario_id>/suspender/', AdminSuspenderUsuarioView.as_view(), name='admin-suspender'),
    path('admin/moderacao/usuarios/<int:usuario_id>/reativar/', AdminReativarUsuarioView.as_view(), name='admin-reativar'),
]
