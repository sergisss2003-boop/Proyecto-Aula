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
| 1 | La contraseña de la base de datos y la `SECRET_KEY` original están en el historial de GitHub | A04 / A02 | `git log --all -p -S"12345678"` muestra el commit `c35dfc1` | Secretos movidos a `.env` (ignorado por git) y **rotados**: `SECRET_KEY` nueva y contraseña de PostgreSQL cambiada con `ALTER USER postgres PASSWORD ...` (27/10/2026). La contraseña publicada ya no sirve. Comprobado: con la clave vieja la conexión es rechazada y con la nueva (solo en `.env`) las 27 pruebas pasan | Corregido |
| 2 | El sitio se sirve solo por HTTP | A04 | Se abre con `http://127.0.0.1:8000` | Certificado de desarrollo (`npm run certificado`: mkcert o autofirmado), `runserver_plus` en `https://localhost:8443`, `SECURE_SSL_REDIRECT`, cookies `Secure`, HSTS de 300 s, `nosniff` y `Referrer-Policy: same-origin`. `certs/` y `*.pem` en `.gitignore`. Comprobado: la respuesta trae `Strict-Transport-Security: max-age=300` y una petición http recibe `301` a https | Corregido |
| 3 | El token del administrador se guarda en `sessionStorage`, legible desde JavaScript | A07 | `sessionStorage.getItem('sesionAdmin')` en la consola devuelve el token | Login nuevo (`cuentas/`): token **JWT firmado (HS256) que vence en 15 min**, en una cookie `HttpOnly` + `Secure` + `SameSite=Strict`. Comprobado: en *F12 → Application → Cookies* la cookie `token` tiene las tres banderas y `document.cookie` **no** la muestra. Token alterado o con `alg: none` → 401 | Corregido |
| 4 | No existe registro de clientes ni roles distintos de admin | A07 / A01 | No hay rutas de registro; solo login de administrador | `POST /api/auth/registro/`: correo y contraseña validados en el servidor (mínimo 10 caracteres + validadores de Django), contraseña guardada con hash `pbkdf2_sha256$...`. El rol lo asigna el servidor (siempre `cliente`). Roles en la Parte 3 | Corregido |
| 5 | Las compras no se registran ni validan en el servidor (el total se calcula en el navegador) | A06 | `Checkout.jsx` no hace ninguna petición a la API | App `pedidos/`: `POST /api/pedidos/` exige sesión (visitante → 401). El navegador solo envía producto, talla y cantidad; **precios, total, envío y dueño los calcula el servidor**. Cantidad entre 1 y 20, talla válida, stock disponible (con `select_for_update`). De la tarjeta solo se guardan marca y últimos 4 dígitos | Corregido |
| 6 | Dependencias con vulnerabilidades conocidas | A03 | `pip-audit`: **Pillow 12.3.0 con 38 vulnerabilidades conocidas** (CVE de 2026 en el procesamiento de imágenes; `pip-audit` no muestra la severidad). `npm audit`: **follow-redirects 1.16.0, alta** (puede reenviar cabeceras con credenciales a otro dominio tras una redirección; la trae axios) | Pillow → 13.0.0 y `npm audit fix` (follow-redirects 1.16.2). Versiones fijas en `requirements.txt` y `package-lock.json`. Resultado: `pip-audit` → *No known vulnerabilities found*; `npm audit` → *found 0 vulnerabilities*. Comando `npm run auditar` | Corregido |
| 7 | Sin registro de eventos ni respuestas de error genéricas | A09 / A10 | No hay `LOGGING` ni `handler404/500`; con `DEBUG=True` un error muestra código, rutas y variables | `LOGGING` a la terminal: logins fallidos (con IP y número de intento), bloqueos 429, registros nuevos y rechazos CSRF (`django.security`). `handler400/403/404/500` devuelven `{"error": "No encontrado"}` / `{"error": "Error interno"}` sin trazas; el detalle queda en el registro. `DEBUG` sale del `.env` (en producción `False`). Pruebas: `ErroresGenericosTests` | Corregido |
| 8 | No había límite de intentos de login propio ni mensajes genéricos | A07 | 6 intentos con clave incorrecta | Máximo 5 fallos por IP en 15 min: el 6.º responde **429**. Mensaje único «Usuario o contraseña incorrectos» (no revela si el correo existe). Pruebas: `python manage.py test cuentas` (9 pruebas OK) | Corregido |
| 9 | Control de acceso por rol en el servidor e IDOR en pedidos | A01 | Con dos clientes A y B: B pide `GET /api/pedidos/<id de A>/` | La consulta siempre filtra por el dueño (`cliente=request.user`) salvo para el administrador. Resultado: B → **404** (igual que un pedido inexistente); cliente `DELETE /api/productos/<id>/` → **403**; administrador → **204**. Pruebas: `python manage.py test pedidos` (10 pruebas OK) | Corregido |
| 10 | XSS almacenado: texto de usuario (nombres, descripciones, datos de envío) que podría llevar HTML | A05 | Se publicó `<img src=x onerror="alert('XSS')">` en el nombre y la descripción de un producto | 1) React escapa todo el texto (no se usa `innerHTML` ni `dangerouslySetInnerHTML`). 2) El servidor elimina las etiquetas HTML antes de guardar (`strip_tags` en productos, categorías y pedidos); un nombre que solo trae HTML se rechaza (400). 3) **CSP** (`SECURE_CSP` de Django 6 y `<meta>` en la versión final de React): `script-src 'self'`. Defensa en profundidad: se forzó un `innerHTML` con el ataque en la versión final y el navegador respondió *Refused to execute inline event handler… script-src 'self'*; no apareció la alerta. Cabeceras `X-Content-Type-Options: nosniff` y `X-Frame-Options: DENY`. Pruebas: `python manage.py test catalogo` | Corregido |
| 11 | Con la sesión en una cookie, otra página podría enviar peticiones a nombre del usuario (CSRF) | A01 | `pruebas_seguridad/ataque.html` (formulario que se envía solo) abierto con la sesión de administrador iniciada | `CsrfViewMiddleware` activo y **ninguna** vista con `@csrf_exempt` (0 resultados). Cookie `csrftoken` con `SameSite=Strict`, legible por JS; `axios` la copia en la cabecera `X-CSRFToken` en cada POST/PUT/PATCH/DELETE (`src/api.js`), y el login, registro y logout también la exigen. `CSRF_TRUSTED_ORIGINS` solo con los orígenes del frontend. Resultado: el ataque recibe **401** y no se crea nada; el panel legítimo sí crea (lleva `X-CSRFToken`); una petición con sesión pero sin la cabecera → **403** (pruebas) | Corregido |
| 12 | `JWT_SECRET` faltante podría pasar desapercibido | A02 | Se quitó `JWT_SECRET` del `.env` | El servidor no arranca y muestra: *«Falta JWT_SECRET en el archivo .env. Genera uno con: python -c "import secrets; print(secrets.token_urlsafe(48))"»* | Corregido |

## Pruebas automáticas

```
npm run pruebas      # = python manage.py test cuentas pedidos catalogo
Ran 27 tests ... OK
```

| Archivo | Qué comprueba |
|---|---|
| `cuentas/tests.py` | Hash de contraseñas, rol `admin` ignorado en el registro, validaciones, cookie `HttpOnly`/`Secure`/`Strict`, mensaje genérico, 6.º intento → 429, ruta privada → 401, token alterado → 401, login sin CSRF → 403, errores 404/500 genéricos |
| `pedidos/tests.py` | Visitante no compra (401), cliente no borra productos (403), admin sí (204), total con precios de la BD, cantidad negativa/cero (400), stock, talla inválida, IDOR (404), admin ve todos, pedido sin CSRF (403) |
| `catalogo/tests.py` | XSS limpiado antes de guardar, nombre solo-HTML rechazado, cabeceras CSP/nosniff/DENY, CSRF con y sin cabecera, cookie `csrftoken` Strict |

## Parte 7 — Auditoría OWASP Top 10 (2025)

| OWASP | Pregunta de revisión | Resultado en Studio SD | Dónde se comprobó |
|---|---|---|---|
| A01 Control de acceso roto | ¿Cada ruta verifica rol **y** propietario en el servidor? | **Sí.** Productos y categorías: escribir solo `is_staff` (cliente → 403). Pedidos: la consulta filtra por dueño (otro → 404). Panel `#/admin` también protegido en el servidor | Parte 3 (hallazgo 9), Parte 5 (hallazgo 11) |
| A02 Configuración insegura | ¿CORS, DEBUG, base de datos y cabeceras están bien? | **Sí.** CORS solo con los orígenes del frontend, `DEBUG` desde `.env`, CSP y cabeceras de seguridad, `check --deploy`: 8 → 2. Pendiente: usuario de BD con permisos mínimos (riesgo R2) | Partes 4 y 6 |
| A03 Cadena de suministro | ¿Se auditaron las dependencias? | **Sí.** `pip-audit` y `npm audit` en 0 tras actualizar Pillow y follow-redirects; versiones fijas | Parte 6.5 (hallazgo 6) |
| A04 Fallas criptográficas | ¿HTTPS activo? ¿Contraseñas con hash lento? ¿Secretos fuera del código? | **Sí.** HTTPS con HSTS, PBKDF2, secretos en `.env`. Los secretos que quedaron en el historial se **rotaron** (`SECRET_KEY` y contraseña de PostgreSQL) | Partes 1, 2 y 6 (hallazgos 1 y 2) |
| A05 Inyección (incluye XSS) | ¿Salida escapada y entradas validadas por tipo? | **Sí.** React escapa, el servidor limpia HTML y valida tipos (serializers), CSP. El ORM de Django usa consultas parametrizadas (sin SQL armado a mano) | Partes 2 y 4 (hallazgo 10) |
| A06 Diseño inseguro | ¿Hay lógica que se pueda abusar? | **Corregido.** Ver pruebas 7.1: cantidad negativa → 400, precio/total enviados por el cliente se ignoran, stock con bloqueo | Parte 7.1 (hallazgo 5) |
| A07 Fallas de autenticación | ¿Límite de intentos, mensajes genéricos, tokens con vencimiento? | **Sí.** 5 intentos/15 min (429), mensaje único, JWT de 15 min en cookie HttpOnly | Parte 2 (hallazgos 3, 4 y 8) |
| A08 Integridad de software o datos | ¿El token está firmado y se verifica? ¿Se confía en datos del cliente (precio, rol)? | **Sí / No.** JWT HS256 verificado (se rechaza `alg: none` y firmas alteradas); el rol sale de la BD y el precio de la BD | Partes 2 y 3 |
| A09 Registros y alertas | ¿Se registran los intentos de login fallidos y los errores? | **Sí, en la terminal.** Falta enviarlos a un sistema central con alertas (riesgo R3) | Parte 6.4 (hallazgo 7) |
| A10 Condiciones excepcionales | ¿Los errores fallan de forma segura? | **Sí.** Respuestas genéricas sin trazas; token inválido → visitante (niega); datos inválidos → 400 sin guardar nada (`transaction.atomic`) | Parte 6.4 |

### 7.1 Pruebas de diseño inseguro (A06)

Ejecutadas contra la aplicación (respuestas reales):

| Prueba | Petición | Respuesta |
|---|---|---|
| Cantidad negativa | `POST /api/pedidos/` con `"cantidad": -5` | **400** `{"items": {"0": {"cantidad": ["Ensure this value is greater than or equal to 1."]}}}` — no se crea el pedido ni cambia el stock |
| Precio manipulado | `POST /api/pedidos/` con `"precio": 1` y `"total": 1` | **201**, pero el total cobrado es **$101.900** (precio real $89.900 + envío $12.000): el servidor ignora los valores del cliente |
| Campo de más | `POST /api/auth/registro/` con `"rol": "admin", "is_staff": true` | **201** `{"rol": "cliente"}` y en la base de datos `is_staff = False` |

## Matriz de riesgos (riesgos que siguen presentes)

| # | Riesgo | Probabilidad | Impacto | Tratamiento |
|---|---|---|---|---|
| R1 | Los secretos viejos siguen visibles en el historial público (ya no sirven) y alguien podría volver a subir un secreto por error | Media | Medio | **Mitigar:** activar *secret scanning* y *push protection* en GitHub y una revisión antes de cada commit (`pre-commit`); opcionalmente limpiar el historial con `git filter-repo` |
| R2 | La aplicación se conecta con el superusuario `postgres` | Baja | **Alto** (si se compromete la app, se compromete todo el servidor de BD) | **Mitigar:** crear un usuario `tienda_app` con permisos solo sobre la base `tienda_studio_sd` |
| R3 | El límite de intentos vive en la memoria del servidor y es por IP (se reinicia al reiniciar; un ataque desde muchas IP lo evade) y los registros solo se ven en la terminal | Media | Medio | **Mitigar:** Redis para el límite, límite también por cuenta, registros centralizados con alertas |
| R4 | El registro no pide la **autorización expresa** para tratar datos personales (Ley 1581) ni hay política de retención | Media | Medio (sanciones de la SIC) | **Mitigar:** casilla de autorización con enlace a la política de privacidad y plazo de borrado de pedidos antiguos |
| R5 | El pago es simulado; cobrar con tarjeta real exige cumplir PCI DSS | Baja (hoy no se cobra) | **Alto** | **Transferir:** usar una pasarela (Wompi, PayU, Mercado Pago) que reciba la tarjeta directamente; la tienda nunca la toca |

## Plan ante un incidente: se filtra la cadena de conexión de la base de datos

(El equivalente en nuestro proyecto a la cadena de Atlas: `DB_USER`, `DB_PASSWORD`, `DB_HOST` de PostgreSQL. **Ya ocurrió**: la contraseña quedó en el historial público; aplicamos la contención cambiándola el 27/10/2026.)

1. **Preparación:** secretos solo en `.env`; `.env.example` sin valores; responsables definidos (quién cambia la contraseña, quién avisa); copia de seguridad de la BD (`pg_dump`) y registros activos.
2. **Detección y análisis:** alerta de *secret scanning* de GitHub o hallazgo manual (`git log --all -p -S"PASSWORD"`). Revisar desde cuándo está expuesta, qué permisos tiene ese usuario y si hay conexiones o cambios sospechosos en los registros de PostgreSQL.
3. **Contención:** cambiar de inmediato la contraseña (`ALTER USER ... PASSWORD`), cerrar conexiones activas (`pg_terminate_backend`), confirmar que PostgreSQL solo acepte conexiones locales (`listen_addresses`, `pg_hba.conf`) y, si es grave, poner la tienda en mantenimiento.
4. **Erradicación:** quitar el secreto del código (ya hecho), limpiar el historial (`git filter-repo` o BFG) sabiendo que lo publicado puede estar copiado, y crear el usuario `tienda_app` de permisos mínimos. Rotar también `DJANGO_SECRET_KEY` y `JWT_SECRET` (cierra todas las sesiones).
5. **Recuperación:** actualizar `.env` en cada equipo, verificar que la tienda funcione, revisar la integridad de los datos (y restaurar la copia si hubo cambios) y vigilar los registros los días siguientes.
6. **Lecciones aprendidas:** documentar la causa (contraseña escrita en `settings.py`), activar revisión automática de secretos antes de cada commit (`pre-commit` / *push protection*), y si hubo acceso a datos personales, avisar a los titulares y a la SIC según la Ley 1581.

## Datos personales (Ley 1581 de 2012)

| Dato que se guarda | Para qué | ¿Necesario? |
|---|---|---|
| Correo, nombre y hash de la contraseña (cuenta) | Iniciar sesión y atender al cliente | Sí |
| Nombre, teléfono, departamento, ciudad, dirección e indicaciones (pedido) | Entregar el pedido y contactar al cliente | Sí, mientras el pedido esté activo y el tiempo que exija la ley contable |
| Correo dentro del pedido | Confirmación de la compra | **Sobra:** ya está en la cuenta; puede tomarse de ahí |
| Marca y últimos 4 dígitos de la tarjeta | Que el cliente reconozca el pago | Discutible; con una pasarela real lo guarda la pasarela. **Nunca** se guardan el número completo ni el CVV |
| IP y correo en los registros de logins fallidos | Seguridad (detectar ataques) | Sí, pero con un plazo de borrado corto |
| Correo del boletín del pie de página | Promociones | Hoy no se guarda; si se guardara, necesita autorización separada |

**Qué falta o debería dejar de hacerse:** pedir la **autorización previa, expresa e informada** al registrarse (casilla + política de tratamiento, art. 9), informar la finalidad, permitir consultar, actualizar y suprimir los datos (derechos del titular, art. 8), definir cuánto tiempo se conservan los pedidos y no duplicar el correo en cada pedido.

## Preguntas de la guía

**Parte 1 — ¿Qué dos garantías da HTTPS que HTTP no da? ¿Garantiza que el sitio sea honesto?**
1) **Confidencialidad:** lo que viaja está cifrado; nadie en la red puede leer contraseñas, cookies o datos de pago. 2) **Integridad y autenticidad del servidor:** nadie puede modificar lo que viaja sin que se note, y el certificado prueba que hablamos con el dueño de ese dominio. **No** garantiza honestidad: un sitio de *phishing* también puede tener candado; HTTPS dice *con quién* hablas y que nadie escucha, no *qué intenciones* tiene.

**Parte 5 — ¿Por qué alguien pondría `@csrf_exempt` «porque da error 403» y por qué es mala idea?**
Porque el 403 aparece apenas el frontend olvida enviar la cabecera `X-CSRFToken`, y `@csrf_exempt` lo «arregla» en un segundo. Es mala idea porque no corrige el error: **apaga la protección**, y cualquier página maliciosa podría enviar peticiones con la sesión del usuario. Lo correcto es enviar la cabecera (en nuestro caso, una sola configuración en `src/api.js`).

**Parte 5 — Si ya usamos `SameSite=Strict`, ¿por qué se añade además el token?**
Por **defensa en profundidad**: si una capa falla, la otra protege. **Navegadores antiguos** o configuraciones que no respetan `SameSite` siguen enviando la cookie. Además, *same-site* no es lo mismo que *same-origin*: un **subdominio** comprometido (por ejemplo `blog.mitienda.com`) cuenta como «el mismo sitio» y su petición sí llevaría la cookie; el token CSRF no lo puede leer, así que la petición se rechaza igual.

## Cierre

**1. ¿Cuál fue el hallazgo más grave y por qué?**
Las credenciales en el historial de un **repositorio público** (hallazgo 1): la contraseña de la base de datos y la `SECRET_KEY` quedaron visibles para cualquiera desde el 29 de septiembre. Con la `SECRET_KEY` se pueden falsificar firmas de Django, y borrar el archivo no basta porque el historial y las copias ya existen: por eso las rotamos (nueva `SECRET_KEY` y nueva contraseña de PostgreSQL).

**2. ¿Qué defensa habría evitado el caso de la clase que más los impactó?**
El de **Uber (2016)**, porque es el mismo error que tuvimos: credenciales guardadas en un repositorio de código. Lo habría evitado mantener los secretos fuera del código (variables de entorno o un gestor de secretos), escanear automáticamente los commits en busca de secretos, MFA en las cuentas de los desarrolladores y rotar las credenciales apenas se detecta la fuga.

**3. ¿Qué dejarían como mejora futura?**
MFA para los administradores, renovación automática del token (*refresh token*) para no cerrar la sesión a los 15 minutos, registros centralizados con alertas, correr `npm run pruebas` y `npm run auditar` automáticamente en cada commit (GitHub Actions), la casilla de autorización de datos de la Ley 1581 y un usuario de base de datos con permisos mínimos.

