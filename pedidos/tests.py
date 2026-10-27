"""Pruebas de la Parte 3 (roles, pedidos e IDOR) y de diseño inseguro A06 (Parte 7).
Ejecutar:  python manage.py test pedidos"""
import json
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, TestCase

from catalogo.models import Categoria, Producto

CLAVE = 'UnaClaveLarga#2026'
ENVIO = {'nombre': 'Ana Pérez', 'email': 'ana@x.com', 'telefono': '3001234567', 'departamento': 'Antioquia',
         'ciudad': 'Medellín', 'direccion': 'Calle 10 # 20-30', 'metodo_envio': 'estandar',
         'tarjeta_marca': 'Visa', 'tarjeta_ultimos4': '4242'}


class PedidosTests(TestCase):
    def setUp(self):
        cache.clear()
        cat = Categoria.objects.create(nombre='Camisetas')
        self.camiseta = Producto.objects.create(nombre='Camiseta', precio=Decimal('50000'), stock=10, talla='S,M,L', categoria=cat)
        self.gorra = Producto.objects.create(nombre='Gorra', precio=Decimal('40000'), stock=2, categoria=cat)
        User.objects.create_user('a@x.com', 'a@x.com', CLAVE)
        User.objects.create_user('b@x.com', 'b@x.com', CLAVE)
        User.objects.create_user('admin@x.com', 'admin@x.com', CLAVE, is_staff=True)

    def cliente(self, email=None):
        c = Client(enforce_csrf_checks=True)
        c.get('/api/auth/csrf/')
        c.csrf = c.cookies['csrftoken'].value
        if email:
            r = c.post('/api/auth/login/', json.dumps({'email': email, 'clave': CLAVE}),
                       content_type='application/json', HTTP_X_CSRFTOKEN=c.csrf)
            assert r.status_code == 200, r.content
        return c

    def comprar(self, c, items, **extra):
        return c.post('/api/pedidos/', json.dumps({**ENVIO, 'items': items, **extra}),
                      content_type='application/json', HTTP_X_CSRFTOKEN=c.csrf)

    # --- Roles ---
    def test_visitante_no_puede_comprar(self):
        self.assertEqual(self.comprar(self.cliente(), [{'producto': self.gorra.id, 'cantidad': 1}]).status_code, 401)

    def test_cliente_no_puede_borrar_productos_403(self):
        c = self.cliente('a@x.com')
        r = c.delete(f'/api/productos/{self.gorra.id}/', HTTP_X_CSRFTOKEN=c.csrf)
        self.assertEqual(r.status_code, 403)

    def test_admin_si_puede_borrar_productos_204(self):
        c = self.cliente('admin@x.com')
        r = c.delete(f'/api/productos/{self.gorra.id}/', HTTP_X_CSRFTOKEN=c.csrf)
        self.assertEqual(r.status_code, 204)

    # --- Pedidos ---
    def test_total_se_calcula_con_precios_de_la_base_de_datos(self):
        c = self.cliente('a@x.com')
        r = self.comprar(c, [{'producto': self.camiseta.id, 'talla': 'M', 'cantidad': 2, 'precio': 1}],
                         total='1', subtotal='1', cliente=999)
        self.assertEqual(r.status_code, 201, r.content)
        datos = r.json()
        self.assertEqual(Decimal(datos['subtotal']), Decimal('100000'))
        self.assertEqual(Decimal(datos['total']), Decimal('112000'))   # + envío estándar
        self.assertEqual(datos['cliente_email'], 'a@x.com')            # el dueño lo pone el servidor
        self.camiseta.refresh_from_db()
        self.assertEqual(self.camiseta.stock, 8)

    def test_cantidad_negativa_o_cero_se_rechaza(self):
        c = self.cliente('a@x.com')
        for cantidad in (-5, 0):
            r = self.comprar(c, [{'producto': self.gorra.id, 'cantidad': cantidad}])
            self.assertEqual(r.status_code, 400)
        self.gorra.refresh_from_db()
        self.assertEqual(self.gorra.stock, 2)

    def test_no_se_vende_mas_que_el_stock(self):
        r = self.comprar(self.cliente('a@x.com'), [{'producto': self.gorra.id, 'cantidad': 3}])
        self.assertEqual(r.status_code, 400)

    def test_talla_inexistente_se_rechaza(self):
        r = self.comprar(self.cliente('a@x.com'), [{'producto': self.camiseta.id, 'talla': 'XXXL', 'cantidad': 1}])
        self.assertEqual(r.status_code, 400)

    # --- IDOR ---
    def test_b_no_puede_ver_el_pedido_de_a(self):
        a, b = self.cliente('a@x.com'), self.cliente('b@x.com')
        pedido_a = self.comprar(a, [{'producto': self.gorra.id, 'cantidad': 1}]).json()['id']
        self.assertEqual(a.get(f'/api/pedidos/{pedido_a}/').status_code, 200)
        self.assertEqual(b.get(f'/api/pedidos/{pedido_a}/').status_code, 404)   # ni siquiera revela que existe
        self.assertEqual(b.get('/api/pedidos/').json(), [])

    def test_admin_ve_todos_los_pedidos(self):
        self.comprar(self.cliente('a@x.com'), [{'producto': self.gorra.id, 'cantidad': 1}])
        self.comprar(self.cliente('b@x.com'), [{'producto': self.gorra.id, 'cantidad': 1}])
        self.assertEqual(len(self.cliente('admin@x.com').get('/api/pedidos/').json()), 2)

    def test_pedido_sin_cabecera_csrf_se_rechaza(self):
        c = self.cliente('a@x.com')
        r = c.post('/api/pedidos/', json.dumps({**ENVIO, 'items': [{'producto': self.gorra.id, 'cantidad': 1}]}),
                   content_type='application/json')
        self.assertEqual(r.status_code, 403)
