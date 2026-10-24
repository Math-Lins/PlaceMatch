from django.contrib import admin
from .models import LogOperacao


@admin.register(LogOperacao)
class LogOperacaoAdmin(admin.ModelAdmin):
    list_display = ['id', 'data_hora', 'usuario', 'acao', 'entidade', 'entidade_id', 'ip']
    list_filter = ['acao']
    search_fields = ['usuario__email', 'entidade']
    readonly_fields = [f.name for f in LogOperacao._meta.get_fields()]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
