from django.contrib import admin
from .models import Compatibilidade, Curtida, Match


@admin.register(Compatibilidade)
class CompatibilidadeAdmin(admin.ModelAdmin):
    list_display = ('perfil_a', 'perfil_b', 'score', 'atualizado_em')
    list_filter = ('atualizado_em',)


@admin.register(Curtida)
class CurtidaAdmin(admin.ModelAdmin):
    list_display = ('perfil_origem', 'perfil_destino', 'tipo', 'data')
    list_filter = ('tipo', 'data')


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('perfil_a', 'perfil_b', 'score', 'data_match')
    list_filter = ('data_match',)
