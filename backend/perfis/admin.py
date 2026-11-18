from django.contrib import admin
from .models import Perfil


@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ['nome', 'usuario', 'regiao', 'idade', 'criado_em']
    list_filter = ['fumante', 'aceita_pets']
    search_fields = ['nome', 'regiao', 'usuario__email']

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # O administrador não participa do matching: o Django admin também não oferece
        # contas de administrador como dono de um perfil (a API já bloqueia com 403).
        if db_field.name == 'usuario':
            from usuarios.models import Usuario
            kwargs['queryset'] = Usuario.objects.exclude(tipo='administrador')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
