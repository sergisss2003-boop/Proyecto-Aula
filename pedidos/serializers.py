import re
import secrets
from decimal import Decimal

from django.db import transaction
from django.utils.html import strip_tags
from rest_framework import serializers

from catalogo.models import Producto
from .models import ItemPedido, Pedido

# Las mismas reglas de envío que muestra la tienda, pero calculadas en el servidor
COSTOS_ENVIO = {'estandar': Decimal('12000'), 'express': Decimal('25000')}
ENVIO_GRATIS_DESDE = Decimal('300000')
MAX_UNIDADES_POR_PRODUCTO = 20


def tallas_de(producto):
    return [t.strip() for t in (producto.talla or '').split(',') if t.strip()]


class ItemEntradaSerializer(serializers.Serializer):
    """Lo único que el cliente puede decir de cada producto: cuál, qué talla y cuántas unidades.
    El precio NO se recibe: se lee de la base de datos."""
    producto = serializers.IntegerField()
    talla = serializers.CharField(max_length=10, required=False, allow_blank=True, default='')
    cantidad = serializers.IntegerField(min_value=1, max_value=MAX_UNIDADES_POR_PRODUCTO)


class ItemSalidaSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ItemPedido
        fields = ['producto', 'nombre', 'talla', 'cantidad', 'precio_unitario', 'subtotal']


class PedidoSerializer(serializers.ModelSerializer):
    items = ItemEntradaSerializer(many=True, write_only=True)
    detalle = ItemSalidaSerializer(source='items', many=True, read_only=True)
    cliente_email = serializers.EmailField(source='cliente.email', read_only=True)

    class Meta:
        model = Pedido
        fields = ['id', 'numero', 'creado', 'estado', 'cliente_email',
                  'nombre', 'email', 'telefono', 'departamento', 'ciudad', 'direccion', 'indicaciones',
                  'metodo_envio', 'tarjeta_marca', 'tarjeta_ultimos4',
                  'items', 'detalle', 'subtotal', 'costo_envio', 'total']
        # Todo lo que tiene que ver con dinero, dueño y estado lo decide el servidor
        read_only_fields = ['id', 'numero', 'creado', 'estado', 'cliente_email', 'subtotal', 'costo_envio', 'total']

    def validate(self, datos):
        for campo in ('nombre', 'telefono', 'departamento', 'ciudad', 'direccion', 'indicaciones', 'tarjeta_marca'):
            if isinstance(datos.get(campo), str):
                datos[campo] = strip_tags(datos[campo]).strip()  # contra XSS almacenado
        if len(datos.get('nombre', '')) < 3:
            raise serializers.ValidationError({'nombre': 'Escribe tu nombre completo.'})
        if not re.fullmatch(r'\d{10}', datos.get('telefono', '').replace(' ', '')):
            raise serializers.ValidationError({'telefono': 'El teléfono debe tener 10 dígitos.'})
        if not re.fullmatch(r'\d{4}', datos.get('tarjeta_ultimos4', '') or '0000'):
            raise serializers.ValidationError({'tarjeta_ultimos4': 'Dato de tarjeta no válido.'})
        items = datos.get('items') or []
        if not 1 <= len(items) <= 50:
            raise serializers.ValidationError({'items': 'El pedido debe tener entre 1 y 50 productos.'})
        return datos

    @transaction.atomic
    def create(self, datos):
        items = datos.pop('items')
        # select_for_update: bloquea los productos mientras se descuenta el stock (evita vender de más)
        ids = {it['producto'] for it in items}
        productos = {p.id: p for p in Producto.objects.select_for_update().filter(id__in=ids, estado='activo')}

        lineas, unidades = [], {}
        for it in items:
            producto = productos.get(it['producto'])
            if producto is None:
                raise serializers.ValidationError({'items': f'El producto {it["producto"]} no existe o no está disponible.'})
            talla = strip_tags(it['talla']).strip()
            tallas = tallas_de(producto)
            if tallas and talla not in tallas:
                raise serializers.ValidationError({'items': f'Talla no válida para {producto.nombre}.'})
            if not tallas:
                talla = ''
            unidades[producto.id] = unidades.get(producto.id, 0) + it['cantidad']
            if unidades[producto.id] > producto.stock:
                raise serializers.ValidationError({'items': f'No hay suficientes unidades de {producto.nombre} (quedan {producto.stock}).'})
            lineas.append((producto, talla, it['cantidad']))

        subtotal = sum((p.precio * c for p, _, c in lineas), Decimal('0'))
        metodo = datos.get('metodo_envio', 'estandar')
        costo_envio = Decimal('0') if metodo == 'estandar' and subtotal >= ENVIO_GRATIS_DESDE else COSTOS_ENVIO[metodo]

        pedido = Pedido.objects.create(
            **datos,
            numero=f'SD-{secrets.token_hex(4).upper()}',
            subtotal=subtotal, costo_envio=costo_envio, total=subtotal + costo_envio,
        )
        for producto, talla, cantidad in lineas:
            ItemPedido.objects.create(pedido=pedido, producto=producto, nombre=producto.nombre, talla=talla,
                                      cantidad=cantidad, precio_unitario=producto.precio)
        for producto_id, cantidad in unidades.items():
            p = productos[producto_id]
            p.stock -= cantidad
            p.save(update_fields=['stock'])
        return pedido
