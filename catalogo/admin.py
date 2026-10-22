from django import forms
from django.contrib import admin

from .models import Categoria, Producto
from .tallas import GRUPOS_TALLAS, separar, grupo_para


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'padre', 'orden')
    list_editable = ('orden',)
    list_filter = ('padre',)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # Solo las categorías principales pueden tener subcategorías
        if db_field.name == 'padre':
            kwargs['queryset'] = Categoria.objects.filter(padre__isnull=True)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


def _campo_tallas(nombre, valores):
    return forms.MultipleChoiceField(
        required=False,
        label=f'Tallas {nombre.lower()}',
        choices=[(v, v) for v in valores],
        widget=forms.CheckboxSelectMultiple,
    )


class ProductoForm(forms.ModelForm):
    """Formulario del producto con casillas para marcar las tallas en vez de escribirlas."""

    # Un grupo de casillas por tipo de talla (Ropa, Pantalón, Zapatos mujer, Zapatos hombre)
    for _clave, _nombre, _valores in GRUPOS_TALLAS:
        locals()[f'tallas_{_clave}'] = _campo_tallas(_nombre, _valores)

    otras_tallas = forms.CharField(
        required=False,
        label='Otras tallas',
        help_text='Opcional. Tallas que no estén en las casillas, separadas por coma (por ejemplo: Única, 4XL).',
    )

    class Meta:
        model = Producto
        exclude = ('talla',)

    class Media:
        css = {'all': ('catalogo/admin_tallas.css',)}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.instance.pk:
            return
        guardadas = separar(self.instance.talla)
        # Si el producto es de Hombre, sus tallas de zapato se muestran en "Zapatos hombre"
        preferido = 'zapatos_hombre' if 'hombre' in str(self.instance.categoria).lower() else None
        grupo = grupo_para(guardadas, preferido)
        if grupo:
            self.initial[f'tallas_{grupo}'] = guardadas
        else:
            self.initial['otras_tallas'] = ', '.join(guardadas)

    def clean(self):
        datos = super().clean()
        tallas = []
        for clave, _, _ in GRUPOS_TALLAS:
            tallas += datos.get(f'tallas_{clave}', [])
        tallas += separar(datos.get('otras_tallas'))
        texto = ','.join(dict.fromkeys(tallas))  # quita repetidas sin cambiar el orden
        if len(texto) > 100:
            raise forms.ValidationError('Hay demasiadas tallas seleccionadas.')
        self.instance.talla = texto
        return datos


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    form = ProductoForm
    list_display = ('nombre', 'categoria', 'precio', 'precio_anterior', 'stock', 'estado')
    list_filter = ('estado', 'categoria')
    search_fields = ('nombre',)
