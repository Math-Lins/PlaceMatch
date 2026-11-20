from django.urls import path
from .views import CompatibilidadeDetalheView, DescobertaView, CurtidaView, MatchListView

urlpatterns = [
    path('descoberta/', DescobertaView.as_view(), name='descoberta'),
    path('curtidas/', CurtidaView.as_view(), name='curtidas'),
    path('matches/', MatchListView.as_view(), name='matches'),
    path('compatibilidade/<int:perfil_id>/', CompatibilidadeDetalheView.as_view(), name='compatibilidade-detalhe'),
]
