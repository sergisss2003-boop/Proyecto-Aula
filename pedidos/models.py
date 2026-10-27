from django.conf import settings
from django.db import models


class Pedido(models.Model):
    ESTADOS = [('recibido', 'Recibido'), ('enviado', 'Enviado'), ('entregado', 'Entregado'), ('cancelado', 'Cancelado')]
    METODOS = [('estandar', 'Envío estándar'), ('express', 'Envío express')]

    numero = models.CharField(max_length=20, unique=True)
    # El dueño del pedido lo pone el servidor (el usuario de la sesión), nunca el cuerpo de la petición
    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pedidos')
    creado = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=12, choices=ESTADOS, default='recibido')

    # Datos de entrega: solo lo necesario para enviar el pedido (Ley 1581: finalidad y minimización)
    nombre = models.CharField(max_length=150)
    email = models.EmailField()
    telefono = models.CharField(max_length=15)
    departamento = models.CharField(max_length=60)
    ciudad = models.CharField(max_length=80)
    direccion = models.CharField(max_length=200)
    indicaciones = models.CharField(max_length=200, blank=True)
    metodo_envio = models.CharField(max_length=10, choices=METODOS, default='estandar')

    # Del pago solo se guarda la marca y los últimos 4 dígitos: NUNCA el número completo ni el CVV
    tarjeta_marca = models.CharField(max_length=20, blank=True)
    tarjeta_ultimos4 = models.CharField(max_length=4, blank=True)

    # Valores calculados por el servidor con los precios de la base de datos
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    costo_envio = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['-creado']

    def __str__(self):
        return self.numero


class ItemPedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='items')
    producto = models.ForeignKey('catalogo.Producto', on_delete=models.SET_NULL, null=True, related_name='+')
    nombre = models.CharField(max_length=150)          # copia del nombre por si el producto cambia
    talla = models.CharField(max_length=10, blank=True)
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def subtotal(self):
        return self.precio_unitario * self.cantidad

    def __str__(self):
        return f'{self.cantidad} × {self.nombre}'
