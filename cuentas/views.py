"""Registro, inicio y cierre de sesión. Son vistas normales de Django: el middleware CSRF las protege."""
import json
import re

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .seguridad import (NOMBRE_COOKIE, autenticado, ip_de, limitado, limpiar_fallos, poner_cookie,
                        registrar_fallo, registro, rol_de)

CORREO = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def _datos(request):
    try:
        datos = json.loads(request.body or '{}')
        return datos if isinstance(datos, dict) else {}
    except ValueError:
        return {}


def _perfil(user):
    return {'email': user.email or user.username, 'nombre': user.first_name or user.username, 'rol': rol_de(user)}


@require_GET
@ensure_csrf_cookie
def csrf(request):
    """El frontend la llama una vez al cargar: crea la cookie csrftoken."""
    return JsonResponse({'ok': True})


@require_POST
def registro_view(request):
    d = _datos(request)
    # Todo se convierte a texto y se valida en el servidor (nunca solo en el frontend)
    email = str(d.get('email', '')).strip().lower()
    clave = str(d.get('clave', ''))
    nombre = str(d.get('nombre', '')).strip()[:150]

    if not CORREO.match(email) or len(email) > 150:
        return JsonResponse({'error': 'Escribe un correo válido.'}, status=400)
    if len(clave) < 10:
        return JsonResponse({'error': 'La contraseña debe tener mínimo 10 caracteres.'}, status=400)
    try:
        validate_password(clave, User(username=email, email=email, first_name=nombre))
    except ValidationError:
        return JsonResponse({'error': 'Esa contraseña es muy común o se parece a tus datos. Usa otra.'}, status=400)
    if User.objects.filter(username=email).exists():
        return JsonResponse({'error': 'Ese correo ya está registrado.'}, status=409)

    # create_user guarda el HASH (PBKDF2), nunca la clave.
    # El rol NO viene del cuerpo de la petición: un usuario nuevo nunca es administrador (is_staff=False).
    user = User.objects.create_user(username=email, email=email, password=clave, first_name=nombre)
    registro.info('Nuevo cliente registrado: %s (IP %s)', email, ip_de(request))
    resp = JsonResponse({'ok': True, **_perfil(user)}, status=201)
    poner_cookie(resp, user)  # queda con la sesión iniciada
    return resp


@require_POST
def login_view(request):
    d = _datos(request)
    usuario = str(d.get('email', '')).strip()
    clave = str(d.get('clave', ''))

    if limitado(request, usuario):
        registro.warning('Login bloqueado por demasiados intentos (IP %s, cuenta "%s")', ip_de(request), usuario[:150])
        return JsonResponse({'error': 'Demasiados intentos. Espera 15 minutos.'}, status=429)

    # Primero tal cual (usuarios administradores) y luego en minúsculas (correos de clientes)
    user = authenticate(request, username=usuario, password=clave) or \
        authenticate(request, username=usuario.lower(), password=clave)

    if user is None:
        intentos = registrar_fallo(request, usuario)
        registro.warning('Login fallido para "%s" (IP %s, intento %s)', usuario[:150], ip_de(request), intentos)
        # Mensaje genérico: no dice si falló el correo o la contraseña (evita adivinar correos)
        return JsonResponse({'error': 'Usuario o contraseña incorrectos.'}, status=401)

    limpiar_fallos(request, usuario)
    registro.info('Login correcto: %s (%s)', user.username, rol_de(user))
    resp = JsonResponse({'ok': True, **_perfil(user)})
    poner_cookie(resp, user)
    return resp


@require_POST
def logout_view(request):
    resp = JsonResponse({'ok': True})
    resp.delete_cookie(NOMBRE_COOKIE, samesite='Strict')
    return resp


@require_GET
@autenticado()
def yo(request):
    """Quién tiene la sesión iniciada (el frontend no puede leer la cookie HttpOnly)."""
    return JsonResponse(_perfil(request.usuario))
