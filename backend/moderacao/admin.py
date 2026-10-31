from django.contrib import admin
from .models import Denuncia


@admin.register(Denuncia)
class DenunciaAdmin(admin.ModelAdmin):
    list_display = ('id', 'denunciante', 'denunciado', 'motivo', 'status', 'criada_em')
    list_filter = ('status', 'motivo')
    search_fields = ('denunciante__email', 'denunciado__email')
    readonly_fields = ('criada_em', 'atualizada_em')
