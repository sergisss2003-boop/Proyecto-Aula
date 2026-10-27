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

## Hallazgos

| # | Hallazgo | OWASP | Evidencia (cómo lo comprobé) | Corrección aplicada | Estado |
|---|---|---|---|---|---|
| 1 | La contraseña de la base de datos y la `SECRET_KEY` original están en el historial de GitHub | A04 / A02 | `git log --all -p -S"12345678"` muestra el commit `c35dfc1` | Secretos movidos a `.env` (ignorado por git), `SECRET_KEY` nueva. Falta rotar la contraseña de PostgreSQL | Mitigado |
| 2 | El sitio se sirve solo por HTTP | A04 | Se abre con `http://127.0.0.1:8000` | Parte 1 | Pendiente |
| 3 | El token del administrador se guarda en `sessionStorage`, legible desde JavaScript | A07 | `sessionStorage.getItem('sesionAdmin')` en la consola devuelve el token | Parte 2 | Pendiente |
| 4 | No existe registro de clientes ni roles distintos de admin | A07 / A01 | No hay rutas de registro; solo login de administrador | Parte 2 y 3 | Pendiente |
| 5 | Las compras no se registran ni validan en el servidor (el total se calcula en el navegador) | A06 | `Checkout.jsx` no hace ninguna petición a la API | Parte 3 | Pendiente |
| 6 | Dependencias con vulnerabilidades conocidas | A03 | `pip-audit`: Pillow 12.3.0 (38). `npm audit`: follow-redirects (alta) | Parte 6 | Pendiente |
| 7 | Sin registro de eventos ni respuestas de error genéricas | A09 / A10 | No hay `LOGGING` ni `handler404/500` | Parte 6 | Pendiente |
