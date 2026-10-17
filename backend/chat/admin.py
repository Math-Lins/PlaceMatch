from django.contrib import admin
from .models import Mensagem


@admin.register(Mensagem)
class MensagemAdmin(admin.ModelAdmin):
    list_display = ['id', 'match', 'remetente', 'data_envio', 'lida']
    list_filter = ['lida']
    search_fields = ['conteudo', 'remetente__nome']
    ordering = ['-data_envio']
