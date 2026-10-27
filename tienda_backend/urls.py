"""
URL configuration for tienda_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerSplitView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('cuentas.urls')),
    path('api/', include('pedidos.urls')),
    path('api/', include('catalogo.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # "Split": el script de Swagger va en un archivo aparte, así funciona con la Content Security Policy
    path('api/docs/', SpectacularSwaggerSplitView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Errores genéricos hacia afuera (sin trazas ni rutas); el detalle queda en el registro del servidor
handler400 = 'cuentas.errores.error_400'
handler403 = 'cuentas.errores.error_403'
handler404 = 'cuentas.errores.error_404'
handler500 = 'cuentas.errores.error_500'