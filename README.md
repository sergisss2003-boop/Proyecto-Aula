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
#    (copia .env.example como .env y llena DJANGO_SECRET_KEY y DB_PASSWORD)
copy .env.example .env        # Windows
# cp .env.example .env        # Mac / Linux

# 3. Instala TODAS las dependencias (Node de la raíz, React y Python)
npm run instalar

# 4. Crea las tablas y el usuario administrador
npm run migrar
npm run admin:crear
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
| `npm run dev:https` | Igual, pero la tienda abre en **https://localhost:5173** |
| `npm run migrar` | Aplica los cambios de la base de datos |
| `npm run admin:crear` | Crea un usuario administrador |
| `npm run revisar` | Revisa errores en Django y en el código de React (ESLint) |
| `npm run revisar:seguridad` | Lista de verificación de seguridad de Django para producción |
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

### HTTPS
- `npm run dev:https` sirve la tienda con https usando un certificado de desarrollo (el navegador mostrará un aviso la primera vez: es normal en local).
- Con `DJANGO_USAR_HTTPS=True` (automático cuando `DJANGO_DEBUG=False`), Django redirige http → https, activa **HSTS** y marca las cookies como **Secure**.
- `SECURE_PROXY_SSL_HEADER` permite que Django sepa que la conexión original era https cuando hay un proxy delante.

### Mitigación de XSS
- React escapa automáticamente todo el texto que muestra (no se usa `dangerouslySetInnerHTML`).
- El backend **elimina etiquetas HTML** de nombres, descripciones, tallas y colores antes de guardarlos (`catalogo/serializers.py`).
- **Content Security Policy (CSP)**: el navegador solo ejecuta scripts del propio sitio. Django la envía en sus respuestas (`SECURE_CSP`) y la versión final de React la incluye en `index.html`.
- Cabeceras `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy`.

### Protección CSRF
- `CsrfViewMiddleware` activo y `CSRF_TRUSTED_ORIGINS` solo con el origen del frontend.
- Cookies con **SameSite=Lax** y la de sesión con **HttpOnly**.
- El panel de la tienda se autentica con un **token en la cabecera** (el navegador no lo envía solo, así que otro sitio no puede usarlo), y el login no depende de cookies.
- El frontend llama a la API en su mismo origen (`/api`, a través del proxy de Vite), así que no hay que abrir CORS a otros sitios.

### Otros
- La clave secreta y la contraseña de la base de datos están en `.env`, que **no se sube a GitHub**.
- El inicio de sesión permite máximo **5 intentos por minuto** (evita adivinar contraseñas).
