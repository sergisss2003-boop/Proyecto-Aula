from django.contrib import admin

from .models import ItemPedido, Pedido


class ItemPedidoInline(admin.TabularInline):
    model = ItemPedido
    extra = 0
    readonly_fields = ('producto', 'nombre', 'talla', 'cantidad', 'precio_unitario')
    can_delete = False


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ('numero', 'cliente', 'creado', 'total', 'estado')
    list_filter = ('estado', 'metodo_envio')
    search_fields = ('numero', 'cliente__email', 'nombre')
    inlines = [ItemPedidoInline]
    # Los montos y el dueño no se editan a mano
    readonly_fields = ('numero', 'cliente', 'creado', 'subtotal', 'costo_envio', 'total', 'tarjeta_marca', 'tarjeta_ultimos4')
