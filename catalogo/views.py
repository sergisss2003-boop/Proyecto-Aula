from rest_framework import viewsets, status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import Categoria, Producto
from .permissions import AdminEscribeLecturaPublica
from .serializers import CategoriaSerializer, ProductoSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [AdminEscribeLecturaPublica]


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    permission_classes = [AdminEscribeLecturaPublica]


class LoginAdminView(ObtainAuthToken):
    """Inicio de sesión del administrador: recibe username y password, y devuelve un token."""

    # El login no usa cookies de sesión, solo devuelve un token (así no depende de cookies que
    # otro sitio pudiera aprovechar: protección CSRF).
    authentication_classes = []
    # Máximo 5 intentos por minuto (ver LIMITE_LOGIN en settings): evita adivinar contraseñas.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        if not user.is_staff:
            return Response(
                {'detail': 'Este usuario no tiene permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'usuario': user.username})