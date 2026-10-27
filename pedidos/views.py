from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Pedido
from .serializers import PedidoSerializer


class PedidoViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                    viewsets.GenericViewSet):
    """
    - Visitante (sin sesión): 401.
    - Cliente: crea pedidos y ve SOLO los suyos. Si pide el pedido de otro → 404 (no se revela que existe).
    - Administrador: ve todos los pedidos.
    No hay editar ni borrar desde la API.
    """
    serializer_class = PedidoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Control de acceso (IDOR): la consulta SIEMPRE incluye al propietario, salvo para el administrador
        qs = Pedido.objects.select_related('cliente').prefetch_related('items')
        if self.request.user.is_staff:
            return qs
        return qs.filter(cliente=self.request.user)

    def perform_create(self, serializer):
        # El dueño es el usuario de la sesión, nunca un dato enviado por el cliente
        serializer.save(cliente=self.request.user)
