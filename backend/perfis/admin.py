from django.contrib import admin
from .models import Perfil


@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ['nome', 'usuario', 'regiao', 'idade', 'criado_em']
    list_filter = ['fumante', 'aceita_pets']
    search_fields = ['nome', 'regiao', 'usuario__email']
