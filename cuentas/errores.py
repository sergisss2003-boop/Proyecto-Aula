"""Respuestas de error genéricas (Parte 6.4).

Hacia afuera solo se dice "Error interno" o "No encontrado": nada de rutas de archivos, trazas
ni variables. El detalle completo queda en la terminal del servidor (ver LOGGING en settings.py).
Django usa estas vistas cuando DEBUG = False.
"""
from django.http import JsonResponse


def error_404(request, exception=None):
    return JsonResponse({'error': 'No encontrado'}, status=404)


def error_500(request):
    return JsonResponse({'error': 'Error interno'}, status=500)


def error_403(request, exception=None):
    return JsonResponse({'error': 'Sin permiso'}, status=403)


def error_400(request, exception=None):
    return JsonResponse({'error': 'Petición no válida'}, status=400)
