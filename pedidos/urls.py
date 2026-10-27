from rest_framework.routers import SimpleRouter

from .views import PedidoViewSet

router = SimpleRouter()  # sin página raíz propia, para no tapar la de /api/
router.register(r'pedidos', PedidoViewSet, basename='pedido')

urlpatterns = router.urls
