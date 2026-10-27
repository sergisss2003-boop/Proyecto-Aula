# Informe de seguridad — Studio SD

Laboratorio de Seguridad — Django (Python) · Desarrollo de Aplicaciones Web

- **Proyecto:** tienda en línea Studio SD (Django + Django REST Framework + React/Vite + PostgreSQL)
- **Rama de trabajo:** `seguridad`

## Parte 0 — Diagnóstico inicial

Estado del proyecto al iniciar el laboratorio (rama `main`, commit `6dbb7e1`). Búsqueda global en el código con *Ctrl + Shift + F* y revisión de `settings.py`.

| Pregunta | Qué se buscó | Resultado |
|---|---|---|
| ⚠ ¿Hay contraseñas guardadas tal cual? | Campos `password`/`clave` | **No.** Los usuarios usan el modelo `User` de Django, que guarda un hash PBKDF2. |
| ⚠ ¿Hay credenciales en el código? | `SECRET_KEY`, `PASSWORD` en `settings.py` | **Sí, en el historial.** Hoy se leen de `.env`, pero el commit `c35dfc1` (29/09) subió `PASSWORD: '12345678'` y la `SECRET_KEY` original. |
| ⚠ ¿Hay archivos de secretos en git? | `git ls-files` | **No.** Solo está `.env.example` (sin valores reales). |
| ⚠ ¿Se muestra texto de usuarios como HTML? | `innerHTML`, `dangerouslySetInnerHTML`, `\|safe`, `mark_safe` | **No.** 0 coincidencias; React escapa el texto. |
| ⚠ ¿Se puede ver un recurso de otro usuario cambiando el id? | Rutas tipo `/api/pedidos/:id` | **No aplica:** el checkout no guardaba pedidos en el servidor (ver hallazgo 5). |
| ⚠ ¿Las rutas de administrador solo están «ocultas» en el frontend? | Botones escondidos sin verificación | **No.** El permiso `AdminEscribeLecturaPublica` exige `is_staff` en el servidor. |
| ⚠ ¿CORS está abierto a cualquier origen? | `CORS_ALLOW_ALL_ORIGINS` | **No.** Solo `localhost:5173`. |
| ⚠ ¿El proyecto usa HTTP simple? | Se abre con `http://` | **Sí.** Django corría solo con `runserver` (http). |

Revisión de `settings.py`: `DEBUG = True` (por defecto, desde `.env`) → **sí** · `ALLOWED_HOSTS = ['*']` → no · `SECRET_KEY` escrita en el archivo → no (pero sí en el historial).

### `python manage.py check --deploy`

| Momento | Advertencias |
|---|---|
| Proyecto original (commit `552f078`) | **8** (W004, W008, W009, W012, W016, W018, W020 y E001 del correo) |
| Inicio del laboratorio (commit `6dbb7e1`) | **6** (W004, W008, W012, W016, W018 y E001) |
| Final, con HTTPS (`npm run dev:https`) | **3** (W018 por `DEBUG=True` en desarrollo, W021 y E001) |
| Final, configuración de producción (`DJANGO_DEBUG=False`) | **2**: W021 (*HSTS preload*: requiere un dominio real inscrito en la lista de los navegadores) y E001 (el correo usa el backend de consola porque la tienda aún no envía correos) |

## Hallazgos

| # | Hallazgo | OWASP | Evidencia (cómo lo comprobé) | Corrección aplicada | Estado |
|---|---|---|---|---|---|
| 1 | La contraseña de la base de datos y la `SECRET_KEY` original están en el historial de GitHub | A04 / A02 | `git log --all -p -S"12345678"` muestra el commit `c35dfc1` | Secretos movidos a `.env` (ignorado por git), `SECRET_KEY` nueva. Falta rotar la contraseña de PostgreSQL | Mitigado |
| 2 | El sitio se sirve solo por HTTP | A04 | Se abre con `http://127.0.0.1:8000` | Certificado de desarrollo (`npm run certificado`: mkcert o autofirmado), `runserver_plus` en `https://localhost:8443`, `SECURE_SSL_REDIRECT`, cookies `Secure`, HSTS de 300 s, `nosniff` y `Referrer-Policy: same-origin`. `certs/` y `*.pem` en `.gitignore`. Comprobado: la respuesta trae `Strict-Transport-Security: max-age=300` y una petición http recibe `301` a https | Corregido |
| 3 | El token del administrador se guarda en `sessionStorage`, legible desde JavaScript | A07 | `sessionStorage.getItem('sesionAdmin')` en la consola devuelve el token | Login nuevo (`cuentas/`): token **JWT firmado (HS256) que vence en 15 min**, en una cookie `HttpOnly` + `Secure` + `SameSite=Strict`. Comprobado: en *F12 → Application → Cookies* la cookie `token` tiene las tres banderas y `document.cookie` **no** la muestra. Token alterado o con `alg: none` → 401 | Corregido |
| 4 | No existe registro de clientes ni roles distintos de admin | A07 / A01 | No hay rutas de registro; solo login de administrador | `POST /api/auth/registro/`: correo y contraseña validados en el servidor (mínimo 10 caracteres + validadores de Django), contraseña guardada con hash `pbkdf2_sha256$...`. El rol lo asigna el servidor (siempre `cliente`). Roles en la Parte 3 | Corregido |
| 8 | No había límite de intentos de login propio ni mensajes genéricos | A07 | 6 intentos con clave incorrecta | Máximo 5 fallos por IP en 15 min: el 6.º responde **429**. Mensaje único «Usuario o contraseña incorrectos» (no revela si el correo existe). Pruebas: `python manage.py test cuentas` (9 pruebas OK) | Corregido |
| 5 | Las compras no se registran ni validan en el servidor (el total se calcula en el navegador) | A06 | `Checkout.jsx` no hace ninguna petición a la API | App `pedidos/`: `POST /api/pedidos/` exige sesión (visitante → 401). El navegador solo envía producto, talla y cantidad; **precios, total, envío y dueño los calcula el servidor**. Cantidad entre 1 y 20, talla válida, stock disponible (con `select_for_update`). De la tarjeta solo se guardan marca y últimos 4 dígitos | Corregido |
| 9 | Control de acceso por rol en el servidor e IDOR en pedidos | A01 | Con dos clientes A y B: B pide `GET /api/pedidos/<id de A>/` | La consulta siempre filtra por el dueño (`cliente=request.user`) salvo para el administrador. Resultado: B → **404** (igual que un pedido inexistente); cliente `DELETE /api/productos/<id>/` → **403**; administrador → **204**. Pruebas: `python manage.py test pedidos` (10 pruebas OK) | Corregido |
| 10 | XSS almacenado: texto de usuario (nombres, descripciones, datos de envío) que podría llevar HTML | A05 | Se publicó `<img src=x onerror="alert('XSS')">` en el nombre y la descripción de un producto | 1) React escapa todo el texto (no se usa `innerHTML` ni `dangerouslySetInnerHTML`). 2) El servidor elimina las etiquetas HTML antes de guardar (`strip_tags` en productos, categorías y pedidos); un nombre que solo trae HTML se rechaza (400). 3) **CSP** (`SECURE_CSP` de Django 6 y `<meta>` en la versión final de React): `script-src 'self'`. Defensa en profundidad: se forzó un `innerHTML` con el ataque en la versión final y el navegador respondió *Refused to execute inline event handler… script-src 'self'*; no apareció la alerta. Cabeceras `X-Content-Type-Options: nosniff` y `X-Frame-Options: DENY`. Pruebas: `python manage.py test catalogo` | Corregido |
| 11 | Con la sesión en una cookie, otra página podría enviar peticiones a nombre del usuario (CSRF) | A01 | `pruebas_seguridad/ataque.html` (formulario que se envía solo) abierto con la sesión de administrador iniciada | `CsrfViewMiddleware` activo y **ninguna** vista con `@csrf_exempt` (0 resultados). Cookie `csrftoken` con `SameSite=Strict`, legible por JS; `axios` la copia en la cabecera `X-CSRFToken` en cada POST/PUT/PATCH/DELETE (`src/api.js`), y el login, registro y logout también la exigen. `CSRF_TRUSTED_ORIGINS` solo con los orígenes del frontend. Resultado: el ataque recibe **401** y no se crea nada; el panel legítimo sí crea (lleva `X-CSRFToken`); una petición con sesión pero sin la cabecera → **403** (pruebas) | Corregido |
| 6 | Dependencias con vulnerabilidades conocidas | A03 | `pip-audit`: **Pillow 12.3.0 con 38 vulnerabilidades** (varias de nivel alto, en el procesamiento de imágenes). `npm audit`: **follow-redirects 1.16.0, alta** (puede reenviar cabeceras con credenciales a otro dominio tras una redirección; la trae axios) | Pillow → 13.0.0 y `npm audit fix` (follow-redirects 1.16.2). Versiones fijas en `requirements.txt` y `package-lock.json`. Resultado: `pip-audit` → *No known vulnerabilities found*; `npm audit` → *found 0 vulnerabilities*. Comando `npm run auditar` | Corregido |
| 7 | Sin registro de eventos ni respuestas de error genéricas | A09 / A10 | No hay `LOGGING` ni `handler404/500`; con `DEBUG=True` un error muestra código, rutas y variables | `LOGGING` a la terminal: logins fallidos (con IP y número de intento), bloqueos 429, registros nuevos y rechazos CSRF (`django.security`). `handler400/403/404/500` devuelven `{"error": "No encontrado"}` / `{"error": "Error interno"}` sin trazas; el detalle queda en el registro. `DEBUG` sale del `.env` (en producción `False`). Pruebas: `ErroresGenericosTests` | Corregido |
| 12 | `JWT_SECRET` faltante podría pasar desapercibido | A02 | Se quitó `JWT_SECRET` del `.env` | El servidor no arranca y muestra: *«Falta JWT_SECRET en el archivo .env. Genera uno con: python -c "import secrets; print(secrets.token_urlsafe(48))"»* | Corregido |
