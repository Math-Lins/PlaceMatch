from django.urls import path
from .views import ConversasView, MensagensView

urlpatterns = [
    path('conversas/', ConversasView.as_view(), name='conversas'),
    path('matches/<int:match_id>/mensagens/', MensagensView.as_view(), name='mensagens'),
]
