"""Herramientas de seguridad de las cuentas: token JWT, roles y límite de intentos de login."""
import datetime
import logging
from functools import wraps

import jwt
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.http import JsonResponse

registro = logging.getLogger('cuentas')

NOMBRE_COOKIE = 'token'


def rol_de(user):
    """El rol lo decide SIEMPRE el servidor a partir de la base de datos, nunca el cliente."""
    return 'admin' if user.is_staff else 'cliente'


def crear_token(user):
    """Token firmado (HS256) que vence en JWT_MINUTOS (15 por defecto)."""
    ahora = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode(
        {'sub': str(user.pk), 'rol': rol_de(user), 'iat': ahora,
         'exp': ahora + datetime.timedelta(minutes=settings.JWT_MINUTOS)},
        settings.JWT_SECRET, algorithm='HS256')


def leer_token(token):
    """Devuelve los datos del token si la firma y la fecha son válidas; si no, None."""
    if not token:
        return None
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])  # solo HS256: evita el ataque "alg: none"
    except jwt.PyJWTError:
        return None


def usuario_del_token(datos):
    if not datos:
        return None
    return User.objects.filter(pk=datos.get('sub'), is_active=True).first()


def poner_cookie(respuesta, user):
    """Cookie con tres banderas: HttpOnly (JavaScript no la lee), Secure (solo HTTPS) y SameSite=Strict."""
    respuesta.set_cookie(
        NOMBRE_COOKIE, crear_token(user),
        max_age=settings.JWT_MINUTOS * 60,
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite='Strict',
    )


# --- Límite de intentos de login ---------------------------------------------------------

def ip_de(request):
    """IP del cliente. Detrás de un proxy (Render) todas las peticiones llegan desde la IP del proxy,
    así que se usa la primera de X-Forwarded-For. Ese dato lo puede falsear el cliente; por eso el
    límite también se cuenta por cuenta de usuario (ver _claves_intentos)."""
    if settings.DETRAS_DE_PROXY:
        reenviada = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if reenviada:
            return reenviada.split(',')[0].strip()[:45]
    return request.META.get('REMOTE_ADDR', '?')


def _claves_intentos(request, usuario):
    # Dos contadores: por IP (frena a quien prueba muchas cuentas) y por cuenta
    # (frena a quien prueba muchas contraseñas contra el mismo correo, aunque cambie de IP)
    return ['login-fallidos:ip:' + ip_de(request),
            'login-fallidos:cuenta:' + usuario.strip().lower()[:150]]


def limitado(request, usuario=''):
    """True si la IP o la cuenta ya tienen LOGIN_MAX_INTENTOS fallidos en la ventana de tiempo."""
    return any(cache.get(c, 0) >= settings.LOGIN_MAX_INTENTOS for c in _claves_intentos(request, usuario))


def registrar_fallo(request, usuario=''):
    intentos = 0
    for clave in _claves_intentos(request, usuario):
        cache.add(clave, 0, settings.LOGIN_VENTANA_SEGUNDOS)  # la ventana empieza con el primer fallo
        intentos = max(intentos, cache.incr(clave))
    return intentos


def limpiar_fallos(request, usuario=''):
    cache.delete_many(_claves_intentos(request, usuario))


# --- Proteger vistas de Django con el token ---------------------------------------------------

def autenticado(rol=None):
    """Decorador para vistas de Django: exige sesión (401) y, si se indica, un rol (403)."""
    def deco(vista):
        @wraps(vista)
        def interna(request, *args, **kwargs):
            datos = leer_token(request.COOKIES.get(NOMBRE_COOKIE))
            user = usuario_del_token(datos)
            if user is None:
                return JsonResponse({'error': 'No autenticado'}, status=401)
            if rol and rol_de(user) != rol:
                return JsonResponse({'error': 'Sin permiso'}, status=403)
            request.usuario = user
            request.rol = rol_de(user)
            return vista(request, *args, **kwargs)
        return interna
    return deco
