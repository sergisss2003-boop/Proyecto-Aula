# Studio SD — Tienda en línea

Proyecto de aula: tienda de ropa juvenil con **backend en Django + Django REST Framework**, **frontend en React + Vite** y base de datos **PostgreSQL**.

## Requisitos

- Python 3.12 o superior
- Node.js 20.19 o superior
- PostgreSQL con una base de datos llamada `tienda_studio_sd`

## Instalación (una sola vez)

```bash
# 1. Entorno virtual de Python
python -m venv venv

# 2. Archivo de configuración con los datos sensibles
#    (copia .env.example como .env y llena DJANGO_SECRET_KEY, JWT_SECRET y DB_PASSWORD)
copy .env.example .env        # Windows
# cp .env.example .env        # Mac / Linux

# 3. Instala TODAS las dependencias (Node de la raíz, React y Python)
npm run instalar

# 4. Crea las tablas y el usuario administrador
npm run migrar
npm run admin:crear

# 5. (Opcional, para HTTPS) crea el certificado de desarrollo
npm run certificado
```

## Uso diario

```bash
npm run dev
```

Arranca **Django y React al mismo tiempo** en una sola terminal. Abre:

- Tienda: http://localhost:5173
- Admin de Django: http://localhost:8000/admin/
- Documentación de la API: http://localhost:8000/api/docs/

Para detener todo: `Ctrl + C`.

## Comandos disponibles (automatizador: npm scripts)

| Comando | Qué hace |
|---|---|
| `npm run instalar` | Instala las dependencias de Node (raíz y frontend) y de Python (`requirements.txt`) |
| `npm run dev` | Arranca backend y frontend juntos |
| `npm run certificado` | Crea el certificado HTTPS de desarrollo en `certs/` (una sola vez) |
| `npm run dev:https` | Django con HTTPS en **https://localhost:8443** y la tienda en **https://localhost:5173** |
| `npm run migrar` | Aplica los cambios de la base de datos |
| `npm run admin:crear` | Crea un usuario administrador |
| `npm run revisar` | Revisa errores en Django y en el código de React (ESLint) |
| `npm run revisar:seguridad` | Lista de verificación de seguridad de Django para producción (`check --deploy`) |
| `npm run pruebas` | Corre las 27 pruebas automáticas de seguridad (login, roles, pedidos, XSS, CSRF, errores) |
| `npm run auditar` | Busca vulnerabilidades conocidas en las dependencias (`pip-audit` y `npm audit`) |
| `npm run build` | Genera la versión final de la tienda (compila React y SCSS) en `tienda_frontend/dist` |
| `npm run preview` | Construye y sirve la versión final, con las cabeceras de seguridad activas |

Dentro de `tienda_frontend` también existe `npm run estilos`, que compila solo el SCSS a CSS (`dist-estilos/main.css`) para ver el resultado.

## Gestores de dependencias

- **pip** + `requirements.txt` para Python, con **versiones fijas** (todos instalan exactamente las mismas).
- **npm** + `package.json` / `package-lock.json` para JavaScript.
- `scripts/python.mjs` permite que los comandos de npm usen el Python del entorno virtual en Windows, Mac o Linux.

## Estilos en SCSS

Los estilos están en `tienda_frontend/src/styles/` y Vite los compila automáticamente.

```
styles/
├── main.scss            ← punto de entrada (el orden de los @use importa)
├── abstractos/          ← no generan CSS por sí solos
│   ├── _variables.scss  ← colores, bordes, fuente, tamaños de pantalla
│   └── _mixins.scss     ← @include hasta($movil) { ... }
├── base/                ← reinicio y estilos generales
├── layout/              ← navbar, menú desplegable, footer
├── componentes/         ← tarjetas, carrito, checkout, descuentos, tallas...
└── paginas/             ← portada, catálogo, producto, ayuda, admin
```

Se usan **variables** (`$negro`, `$rojo-descuento`, `$radio-pildora`...), **anidamiento** (`.nav-links { a { &.activo { ... } } }`), **parciales** con `@use` y un **mixin** para los tamaños de pantalla.

## Seguridad

El detalle completo (hallazgos, pruebas, OWASP y riesgos) está en **[INFORME_SEGURIDAD.md](INFORME_SEGURIDAD.md)**.

### Roles

| Rol | Ver catálogo | Comprar | Crear/editar/borrar productos | Ver pedidos |
|---|---|---|---|---|
| Visitante | Sí | No (debe iniciar sesión) | No | No |
| Cliente (se registra en la tienda) | Sí | Sí | No (403) | Solo los suyos |
| Administrador (`is_staff`) | Sí | Sí | Sí | Todos |

Para convertir un usuario en administrador: `npm run admin:crear` o, en `python manage.py shell`, poner `is_staff = True`.

### HTTPS
- `npm run certificado` crea `certs/cert.pem` y `certs/key.pem` (con **mkcert** si está instalado; si no, autofirmado). `certs/` está en `.gitignore`.
- `npm run dev:https` corre Django con **runserver_plus en https://localhost:8443** y la tienda en **https://localhost:5173**.
- Con HTTPS activo: redirección http → https, cookies `Secure`, **HSTS** (300 s en el laboratorio, 1 año en producción), `nosniff` y `Referrer-Policy: same-origin`.
- Ojo: HSTS aplica a todo `localhost`. Si después usas `npm run dev` (http) y el navegador te manda a https, espera 5 minutos o bórralo en `chrome://net-internals/#hsts`.

### Registro, login y sesión
- Registro (`/api/auth/registro/`): contraseña de mínimo 10 caracteres, guardada con **hash PBKDF2**. El rol lo asigna el servidor (nunca el cliente).
- Login (`/api/auth/login/`): entrega un **token JWT firmado que vence en 15 minutos** dentro de una cookie **HttpOnly + Secure + SameSite=Strict** (JavaScript no puede leerla).
- Mensaje genérico «Usuario o contraseña incorrectos» y **máximo 5 intentos fallidos**: el 6.º responde 429 durante 15 minutos.

### Mitigación de XSS
- React escapa todo el texto (no se usa `innerHTML` ni `dangerouslySetInnerHTML`).
- El servidor elimina las etiquetas HTML de nombres, descripciones, tallas, colores y datos de envío antes de guardarlos.
- **Content Security Policy**: Django la envía en sus respuestas (`SECURE_CSP`) y la versión final de React la lleva en `index.html`. Solo se ejecutan scripts del propio sitio.

### Protección CSRF
- `CsrfViewMiddleware` activo y ninguna vista con `@csrf_exempt`.
- Cookie `csrftoken` con `SameSite=Strict`; `src/api.js` la copia en la cabecera **`X-CSRFToken`** en cada petición que modifica datos (incluidos login, registro y logout).
- Prueba: `pruebas_seguridad/ataque.html` (ver instrucciones dentro del archivo).

### Pedidos
- El navegador solo envía producto, talla y cantidad; **precios, envío, total y dueño los calcula el servidor**.
- Cada cliente ve solo sus pedidos: pedir el de otro responde 404 (IDOR corregido).
- De la tarjeta solo se guardan la marca y los últimos 4 dígitos.

### Secretos, errores y dependencias
- `DJANGO_SECRET_KEY`, `JWT_SECRET` y `DB_PASSWORD` van en `.env` (no se sube a GitHub). Si falta alguno, el servidor no arranca y dice cuál.
- Errores genéricos hacia afuera (`{"error": "Error interno"}`); el detalle y los intentos de login fallidos quedan en el registro de la terminal.
- `npm run auditar` revisa vulnerabilidades conocidas en las dependencias de Python y de JavaScript.
