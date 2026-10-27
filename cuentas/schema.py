"""Le explica a Swagger (drf-spectacular) cómo se autentica la API: con la cookie "token"."""
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class CookieJWTScheme(OpenApiAuthenticationExtension):
    target_class = 'cuentas.autenticacion.CookieJWTAuthentication'
    name = 'cookieJWT'

    def get_security_definition(self, auto_schema):
        return {'type': 'apiKey', 'in': 'cookie', 'name': 'token'}
