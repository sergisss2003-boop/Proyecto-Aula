"""Pruebas de la Parte 2 (registro, login, token y límite de intentos).
Ejecutar:  python manage.py test cuentas"""
import json

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, TestCase

CLAVE = 'UnaClaveLarga#2026'


class CuentasTests(TestCase):
    def setUp(self):
        cache.clear()
        # enforce_csrf_checks=True: el cliente de pruebas se comporta como un navegador real
        self.c = Client(enforce_csrf_checks=True)
        self.c.get('/api/auth/csrf/')
        self.csrf = self.c.cookies['csrftoken'].value

    def post(self, url, datos, cliente=None):
        cliente = cliente or self.c
        return cliente.post(url, json.dumps(datos), content_type='application/json', HTTP_X_CSRFTOKEN=self.csrf)

    def test_registro_guarda_hash_y_nunca_la_clave(self):
        r = self.post('/api/auth/registro/', {'email': 'Ana@Correo.com', 'clave': CLAVE})
        self.assertEqual(r.status_code, 201)
        u = User.objects.get(username='ana@correo.com')
        self.assertTrue(u.password.startswith('pbkdf2_sha256$'))
        self.assertNotIn(CLAVE, u.password)

    def test_registro_ignora_rol_admin_enviado_por_el_cliente(self):
        r = self.post('/api/auth/registro/', {'email': 'hacker@x.com', 'clave': CLAVE, 'rol': 'admin', 'is_staff': True})
        self.assertEqual(r.json()['rol'], 'cliente')
        self.assertFalse(User.objects.get(username='hacker@x.com').is_staff)

    def test_registro_valida_datos(self):
        self.assertEqual(self.post('/api/auth/registro/', {'email': 'malo', 'clave': CLAVE}).status_code, 400)
        self.assertEqual(self.post('/api/auth/registro/', {'email': 'a@b.co', 'clave': 'corta'}).status_code, 400)
        self.post('/api/auth/registro/', {'email': 'a@b.co', 'clave': CLAVE})
        self.assertEqual(self.post('/api/auth/registro/', {'email': 'a@b.co', 'clave': CLAVE}).status_code, 409)

    def test_login_entrega_cookie_httponly_secure_strict(self):
        User.objects.create_user('cli@x.com', 'cli@x.com', CLAVE)
        r = self.post('/api/auth/login/', {'email': 'cli@x.com', 'clave': CLAVE})
        self.assertEqual(r.status_code, 200)
        cookie = r.cookies['token']
        self.assertTrue(cookie['httponly'])
        self.assertTrue(cookie['secure'])
        self.assertEqual(cookie['samesite'], 'Strict')
        self.assertEqual(cookie['max-age'], 900)

    def test_mensaje_generico_en_login_fallido(self):
        User.objects.create_user('cli@x.com', 'cli@x.com', CLAVE)
        a = self.post('/api/auth/login/', {'email': 'cli@x.com', 'clave': 'incorrecta'})
        b = self.post('/api/auth/login/', {'email': 'noexiste@x.com', 'clave': 'incorrecta'})
        self.assertEqual(a.status_code, 401)
        self.assertEqual(a.json(), b.json())  # no revela si el correo existe

    def test_sexto_intento_fallido_responde_429(self):
        codigos = [self.post('/api/auth/login/', {'email': 'x@x.com', 'clave': 'mala'}).status_code for _ in range(6)]
        self.assertEqual(codigos, [401] * 5 + [429])

    def test_ruta_privada_sin_sesion_responde_401(self):
        self.assertEqual(self.c.get('/api/auth/yo/').status_code, 401)

    def test_token_alterado_no_sirve(self):
        self.c.cookies['token'] = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIiwicm9sIjoiYWRtaW4ifQ.'
        self.assertEqual(self.c.get('/api/auth/yo/').status_code, 401)

    def test_login_sin_token_csrf_es_rechazado(self):
        r = self.c.post('/api/auth/login/', json.dumps({'email': 'a', 'clave': 'b'}), content_type='application/json')
        self.assertEqual(r.status_code, 403)
