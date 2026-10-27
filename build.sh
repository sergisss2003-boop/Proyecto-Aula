#!/usr/bin/env bash
# Construcción en Render (se ejecuta en cada despliegue). Ver render.yaml.
set -o errexit

echo "==> Dependencias de Python"
pip install -r requirements.txt

echo "==> Tienda React (compilar)"
npm ci --prefix tienda_frontend
npm run build --prefix tienda_frontend

echo "==> Archivos estáticos y base de datos"
python manage.py collectstatic --noinput
python manage.py migrate --noinput
python manage.py cargar_catalogo

# El administrador se crea con las variables DJANGO_SUPERUSER_USERNAME / _EMAIL / _PASSWORD
# (Render gratis no tiene consola para ejecutar createsuperuser a mano)
if [ -n "$DJANGO_SUPERUSER_USERNAME" ]; then
  python manage.py createsuperuser --noinput || echo "El administrador ya existe."
fi
