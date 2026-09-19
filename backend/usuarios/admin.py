from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ['email', 'username', 'tipo', 'is_active', 'date_joined']
    list_filter = ['tipo', 'is_active']
    fieldsets = UserAdmin.fieldsets + (
        ('PlaceMatch', {'fields': ('tipo',)}),
    )
