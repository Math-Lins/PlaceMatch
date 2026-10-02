from django.urls import path
from .views import DescobertaView, CurtidaView, MatchListView

urlpatterns = [
    path('descoberta/', DescobertaView.as_view(), name='descoberta'),
    path('curtidas/', CurtidaView.as_view(), name='curtidas'),
    path('matches/', MatchListView.as_view(), name='matches'),
]
