from django.apps import AppConfig


class CuentasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'cuentas'
    verbose_name = 'Cuentas y seguridad'

    def ready(self):
        from . import schema  # noqa: F401  (registra la autenticación por cookie en Swagger)
