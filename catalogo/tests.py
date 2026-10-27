"""Pruebas de la Parte 4 (XSS) y de la Parte 5 (CSRF) sobre el catálogo.
Ejecutar:  python manage.py test catalogo"""
import json

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, TestCase

from .models import Categoria, Producto

CLAVE = 'UnaClaveLarga#2026'
ATAQUE = '<img src=x onerror="alert(\'XSS\')">'


class XssYCsrfTests(TestCase):
    def setUp(self):
        cache.clear()
        User.objects.create_user('admin@x.com', 'admin@x.com', CLAVE, is_staff=True)
        self.cat = Categoria.objects.create(nombre='Camisetas')
        self.c = Client(enforce_csrf_checks=True)
        self.c.get('/api/auth/csrf/')
        self.csrf = self.c.cookies['csrftoken'].value
        self.c.post('/api/auth/login/', json.dumps({'email': 'admin@x.com', 'clave': CLAVE}),
                    content_type='application/json', HTTP_X_CSRFTOKEN=self.csrf)

    def crear(self, con_csrf=True, **campos):
        datos = {'nombre': 'Camiseta', 'precio': '50000', 'stock': 5, 'categoria': self.cat.id, **campos}
        extra = {'HTTP_X_CSRFTOKEN': self.csrf} if con_csrf else {}
        return self.c.post('/api/productos/', json.dumps(datos), content_type='application/json', **extra)

    # --- Parte 4: XSS ---
    def test_xss_almacenado_se_limpia_antes_de_guardar(self):
        r = self.crear(nombre=f'Camiseta {ATAQUE}', descripcion=f'Linda {ATAQUE}<script>robar()</script>')
        self.assertEqual(r.status_code, 201)
        p = Producto.objects.get()
        self.assertNotIn('<', p.nombre + p.descripcion)
        self.assertEqual(p.nombre, 'Camiseta')

    def test_nombre_solo_con_html_se_rechaza(self):
        self.assertEqual(self.crear(nombre='<script></script>').status_code, 400)

    def test_cabeceras_de_seguridad(self):
        r = Client().get('/api/productos/')
        self.assertIn("script-src 'self'", r['Content-Security-Policy'])
        self.assertIn("frame-ancestors 'none'", r['Content-Security-Policy'])
        self.assertEqual(r['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(r['X-Frame-Options'], 'DENY')

    # --- Parte 5: CSRF ---
    def test_crear_producto_con_cabecera_csrf_funciona(self):
        self.assertEqual(self.crear().status_code, 201)

    def test_crear_producto_sin_cabecera_csrf_se_rechaza(self):
        r = self.crear(con_csrf=False)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(Producto.objects.count(), 0)

    def test_cookie_csrf_es_strict(self):
        r = Client().get('/api/auth/csrf/')
        self.assertEqual(r.cookies['csrftoken']['samesite'], 'Strict')


class CloudinaryStorageTests(TestCase):
    """El almacenamiento de producción guarda cada imagen con un identificador fijo en Cloudinary."""

    def test_nombre_y_url(self):
        from unittest import mock

        from django.core.files.base import ContentFile

        from tienda_backend.almacenamiento import CloudinaryStorage, id_publico
        self.assertEqual(id_publico('productos/jean.webp'), 'studio-sd/productos/jean')
        almacen = CloudinaryStorage()
        with mock.patch('cloudinary.uploader.upload') as subir, \
                mock.patch('cloudinary.config', return_value=mock.Mock(cloud_name='demo')):
            nombre = almacen._save('productos/jean.webp', ContentFile(b'imagen'))
        self.assertEqual(nombre, 'productos/jean.webp')
        self.assertEqual(subir.call_args.kwargs['public_id'], 'studio-sd/productos/jean')
        import cloudinary
        cloudinary.config(cloud_name='demo')
        self.assertTrue(almacen.url(nombre).startswith('https://res.cloudinary.com/demo/image/upload/'))
        self.assertTrue(almacen.url(nombre).endswith('studio-sd/productos/jean.webp'))
