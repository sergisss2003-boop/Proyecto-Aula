from rest_framework import viewsets

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
