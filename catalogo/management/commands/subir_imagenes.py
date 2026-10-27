"""Sube a Cloudinary las fotos de los productos que están en la carpeta media/ de este computador.

Uso (con CLOUDINARY_URL en el archivo .env):   npm run subir-imagenes
"""
import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from catalogo.models import Producto


class Command(BaseCommand):
    help = 'Sube a Cloudinary las imágenes de los productos guardadas en media/'

    def handle(self, *args, **opciones):
        if not os.environ.get('CLOUDINARY_URL'):
            raise CommandError('Falta CLOUDINARY_URL en el archivo .env (cópiala del panel de Cloudinary).')
        from tienda_backend.almacenamiento import subir

        subidas, faltan = 0, []
        for producto in Producto.objects.exclude(imagen=''):
            ruta = Path(settings.MEDIA_ROOT) / producto.imagen.name
            if not ruta.exists():
                faltan.append(producto.imagen.name)
                continue
            with open(ruta, 'rb') as archivo:
                subir(archivo, producto.imagen.name)
            subidas += 1
            self.stdout.write(f'  ✓ {producto.imagen.name}')
        self.stdout.write(self.style.SUCCESS(f'{subidas} imágenes subidas a Cloudinary.'))
        if faltan:
            self.stdout.write(self.style.WARNING(f'No se encontraron en media/: {", ".join(faltan)}'))
