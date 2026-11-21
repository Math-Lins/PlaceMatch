from django.apps import AppConfig


class IaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ia'
    verbose_name = 'Afinidade por IA'

    def ready(self):
        # Só no servidor da API (runserver/gunicorn): carrega o modelo em segundo plano, sem bloquear a subida.
        from .aquecimento import iniciar_se_servidor
        iniciar_se_servidor()
