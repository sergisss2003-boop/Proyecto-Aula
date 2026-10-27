"""Carga las categorías y productos iniciales (catalogo/fixtures/catalogo_inicial.json) SOLO si la
base de datos todavía no tiene productos. Se ejecuta en cada despliegue de Render, pero después de la
primera vez no hace nada, así que no borra lo que el administrador cambie en producción."""
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand

from catalogo.models import Categoria, Producto

ARCHIVO = Path(__file__).resolve().parents[2] / 'fixtures' / 'catalogo_inicial.json'


class Command(BaseCommand):
    help = 'Carga el catálogo inicial si la base de datos está vacía'

    def handle(self, *args, **opciones):
        if Producto.objects.exists() or Categoria.objects.exists():
            self.stdout.write('El catálogo ya tiene datos: no se carga nada.')
            return
        if not ARCHIVO.exists():
            self.stdout.write('No hay catalogo_inicial.json: la tienda arranca vacía.')
            return
        call_command('loaddata', str(ARCHIVO))
        self.stdout.write(self.style.SUCCESS('Catálogo inicial cargado.'))
