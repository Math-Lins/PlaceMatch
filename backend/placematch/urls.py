from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    # Documentação da API: aberta com DEBUG=True; em produção, só administrador (veja placematch/permissoes.py)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
    path('api/auth/', include('usuarios.urls')),
    path('api/perfis/', include('perfis.urls')),
    path('api/', include('matches.urls')),
    path('api/', include('chat.urls')),
    path('api/', include('logs.urls')),
    path('api/', include('painel.urls')),
    path('api/', include('moderacao.urls')),
]
