from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegistrarView, MeView

urlpatterns = [
    path('registrar/', RegistrarView.as_view(), name='auth-registrar'),
    path('login/', TokenObtainPairView.as_view(), name='auth-login'),
    path('login/refresh/', TokenRefreshView.as_view(), name='auth-login-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
]
