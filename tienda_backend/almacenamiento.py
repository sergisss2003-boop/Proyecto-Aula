"""Guarda las imágenes de los productos en Cloudinary (en producción).

En Render el disco de un servicio gratuito se borra en cada reinicio o despliegue, así que las
fotos que suba el administrador tienen que vivir en otro lado. Las credenciales se leen solas de la
variable de entorno CLOUDINARY_URL (cloudinary://API_KEY:API_SECRET@CLOUD_NAME).

El nombre que Django guarda en la base de datos (por ejemplo "productos/jean.webp") se convierte
siempre en el mismo identificador de Cloudinary ("studio-sd/productos/jean"), así que las imágenes
se pueden subir desde el computador con el comando `subir_imagenes` y la base de datos las encuentra.
"""
import posixpath

import cloudinary
import cloudinary.api
import cloudinary.uploader
import cloudinary.utils
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

CARPETA = 'studio-sd'


def id_publico(nombre):
    """'productos/jean.webp' -> 'studio-sd/productos/jean'"""
    base, _ext = posixpath.splitext(nombre.replace('\\', '/'))
    return f'{CARPETA}/{base}'


def subir(archivo, nombre):
    archivo.seek(0)
    cloudinary.uploader.upload(
        archivo, public_id=id_publico(nombre), resource_type='image',
        overwrite=True, unique_filename=False, use_filename=False,
    )


@deconstructible
class CloudinaryStorage(Storage):
    def _save(self, name, content):
        subir(content, name)
        return name

    def exists(self, name):
        try:
            cloudinary.api.resource(id_publico(name))
            return True
        except cloudinary.exceptions.NotFound:
            return False

    def url(self, name):
        formato = posixpath.splitext(name)[1].lstrip('.') or None
        return cloudinary.utils.cloudinary_url(id_publico(name), secure=True, format=formato)[0]

    def delete(self, name):
        cloudinary.uploader.destroy(id_publico(name), resource_type='image')

    def size(self, name):
        return cloudinary.api.resource(id_publico(name)).get('bytes', 0)
