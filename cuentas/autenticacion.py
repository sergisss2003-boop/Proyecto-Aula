"""Autenticación de la API (Django REST Framework) con el token JWT de la cookie."""
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, CSRFCheck

from .seguridad import NOMBRE_COOKIE, leer_token, usuario_del_token


class CookieJWTAuthentication(BaseAuthentication):
    """Lee el token de la cookie HttpOnly. Si no hay token o es inválido/vencido, la petición
    sigue como visitante (anónima) y los permisos deciden: 401 si la ruta exige sesión."""

    def authenticate(self, request):
        datos = leer_token(request.COOKIES.get(NOMBRE_COOKIE))
        user = usuario_del_token(datos)
        if user is None:
            return None
        self.exigir_csrf(request)
        return (user, datos)

    def exigir_csrf(self, request):
        """Como la sesión viaja en una cookie que el navegador envía solo, toda petición que
        modifica datos (POST, PUT, PATCH, DELETE) debe traer además la cabecera X-CSRFToken."""
        def respuesta_vacia(request):
            return None
        verificacion = CSRFCheck(respuesta_vacia)
        verificacion.process_request(request)
        motivo = verificacion.process_view(request, None, (), {})
        if motivo:
            raise exceptions.PermissionDenied(f'CSRF fallido: {motivo}')

    def authenticate_header(self, request):
        # Hace que una ruta privada sin sesión responda 401 (y no 403)
        return 'Cookie realm="api"'
