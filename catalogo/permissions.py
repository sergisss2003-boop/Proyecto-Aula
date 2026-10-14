from rest_framework.permissions import BasePermission, SAFE_METHODS


class AdminEscribeLecturaPublica(BasePermission):
    """Cualquiera puede consultar (GET); solo un administrador puede crear, editar o eliminar."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)