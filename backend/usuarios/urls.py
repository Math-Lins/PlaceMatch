from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegistrarView, LoginView, MeView

urlpatterns = [
    path('registrar/', RegistrarView.as_view(), name='auth-registrar'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('login/refresh/', TokenRefreshView.as_view(), name='auth-login-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
]
