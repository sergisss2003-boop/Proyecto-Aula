from django.utils.html import strip_tags
from rest_framework import serializers

from .models import Categoria, Producto


class SinHTMLMixin:
    """Protección contra XSS: quita cualquier etiqueta HTML (<script>, <img onerror=...>, etc.)
    de los campos de texto antes de guardarlos en la base de datos."""

    campos_texto = ()

    def validate(self, datos):
        datos = super().validate(datos)
        for campo in self.campos_texto:
            if isinstance(datos.get(campo), str):
                datos[campo] = strip_tags(datos[campo]).strip()
        return datos


class CategoriaSerializer(SinHTMLMixin, serializers.ModelSerializer):
    campos_texto = ('nombre', 'descripcion')

    class Meta:
        model = Categoria
        fields = '__all__'

    def validate_nombre(self, valor):
        if not strip_tags(valor).strip():
            raise serializers.ValidationError('El nombre no puede estar vacío.')
        return valor


class ProductoSerializer(SinHTMLMixin, serializers.ModelSerializer):
    campos_texto = ('nombre', 'descripcion', 'talla', 'color')

    class Meta:
        model = Producto
        fields = '__all__'

    def validate_nombre(self, valor):
        if not strip_tags(valor).strip():
            raise serializers.ValidationError('El nombre no puede estar vacío.')
        return valor

    def validate(self, datos):
        datos = super().validate(datos)
        precio = datos.get('precio', getattr(self.instance, 'precio', None))
        anterior = datos.get('precio_anterior', getattr(self.instance, 'precio_anterior', None))
        if anterior is not None and precio is not None and anterior <= precio:
            raise serializers.ValidationError({'precio_anterior': 'El precio antes debe ser mayor que el precio actual.'})
        return datos
