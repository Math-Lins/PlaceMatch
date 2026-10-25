from django.urls import path
from .views import (
    DashboardView,
    RelatoriosCatalogoView,
    RelatorioDetalheView,
    AdminUsuariosView,
    AdminUsuariosExportarView,
)

urlpatterns = [
    path('admin/dashboard/', DashboardView.as_view(), name='dashboard'),
    path('admin/relatorios/', RelatoriosCatalogoView.as_view(), name='relatorios-catalogo'),
    path('admin/relatorios/<str:rel_id>/', RelatorioDetalheView.as_view(), name='relatorio-detalhe'),
    path('admin/usuarios/', AdminUsuariosView.as_view(), name='admin-usuarios'),
    path('admin/usuarios/exportar/', AdminUsuariosExportarView.as_view(), name='admin-usuarios-exportar'),
]
