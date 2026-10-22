from django.db import models

class Categoria(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    # Si está vacío, es una categoría principal del menú (Mujer, Hombre...).
    # Si tiene una, es una subcategoría que aparece en el desplegable (Camisas dentro de Mujer).
    padre = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subcategorias',
        verbose_name='Pertenece a',
        help_text='Déjalo vacío para una categoría principal del menú (Mujer, Hombre, Accesorios...).',
    )
    orden = models.PositiveIntegerField(
        default=0,
        help_text='Posición en el menú: los números más bajos aparecen primero.',
    )

    class Meta:
        ordering = ['orden', 'id']

    def __str__(self):
        return f'{self.padre.nombre} › {self.nombre}' if self.padre_id else self.nombre


class Producto(models.Model):
    ESTADO_CHOICES = [
        ('activo', 'Activo'),
        ('inactivo', 'Inactivo'),
    ]

    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    # Si tiene un valor mayor que el precio, el producto está en descuento:
    # sale en la sección Descuentos con el precio anterior tachado.
    precio_anterior = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Precio antes (descuento)',
        help_text='Opcional. Escribe aquí el precio original para poner el producto en descuento. Debe ser mayor que el precio.',
    )
    stock = models.PositiveIntegerField(default=0)
    # Tallas disponibles separadas por coma, por ejemplo "S,M,L" o "36,37,38"
    talla = models.CharField(max_length=100, blank=True)
    color = models.CharField(max_length=50, blank=True)
    imagen = models.ImageField(upload_to='productos/', blank=True, null=True)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='activo')
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE, related_name='productos')

    @property
    def en_descuento(self):
        return self.precio_anterior is not None and self.precio_anterior > self.precio

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.precio_anterior is not None and self.precio is not None and self.precio_anterior <= self.precio:
            raise ValidationError({'precio_anterior': 'El precio antes debe ser mayor que el precio actual.'})

    def __str__(self):
        return self.nombre