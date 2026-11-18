from django.urls import path
from .views import (
    RegistrarView, LoginView, LogoutView, MeView, RedefinirSenhaView, RenovarTokenView, SolicitarSenhaView,
)

urlpatterns = [
    path('registrar/', RegistrarView.as_view(), name='auth-registrar'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('login/refresh/', RenovarTokenView.as_view(), name='auth-login-refresh'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('senha/solicitar/', SolicitarSenhaView.as_view(), name='auth-senha-solicitar'),
    path('senha/redefinir/', RedefinirSenhaView.as_view(), name='auth-senha-redefinir'),
    path('me/', MeView.as_view(), name='auth-me'),
]
