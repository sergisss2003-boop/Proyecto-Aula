from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, ProductoViewSet, LoginAdminView

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'productos', ProductoViewSet)

urlpatterns = [
    path('login/', LoginAdminView.as_view(), name='login-admin'),
] + router.urls