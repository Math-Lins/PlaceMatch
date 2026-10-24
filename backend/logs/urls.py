from django.urls import path
from .views import LogListView, LogExportarView

urlpatterns = [
    path('admin/logs/', LogListView.as_view(), name='logs-list'),
    path('admin/logs/exportar/', LogExportarView.as_view(), name='logs-exportar'),
]
