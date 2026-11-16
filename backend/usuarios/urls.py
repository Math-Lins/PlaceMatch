from django.urls import path
from .views import RegistrarView, LoginView, MeView, RenovarTokenView

urlpatterns = [
    path('registrar/', RegistrarView.as_view(), name='auth-registrar'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('login/refresh/', RenovarTokenView.as_view(), name='auth-login-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
]
