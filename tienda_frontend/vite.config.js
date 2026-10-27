import { existsSync, readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv } from 'vite'

// Certificado creado con "npm run certificado" (carpeta certs/ en la raíz del proyecto)
const CERT = new URL('../certs/cert.pem', import.meta.url)
const CLAVE = new URL('../certs/key.pem', import.meta.url)

// Content Security Policy: el navegador solo carga scripts, estilos, imágenes y conexiones
// de este mismo sitio. Si alguien lograra inyectar un <script>, el navegador lo bloquearía (XSS).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React usa style={{...}} para las imágenes de fondo
  "img-src 'self' data: blob:",      // blob: vista previa de la imagen en el panel de admin
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// Agrega la CSP dentro del index.html de la versión final (npm run build).
// En "npm run dev" no se aplica porque Vite necesita scripts internos para recargar en vivo.
function cspEnProduccion() {
  return {
    name: 'csp-en-produccion',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // "npm run dev:https" usa el modo https: la tienda abre en https://localhost:5173
  // y Django corre con runserver_plus en https://localhost:8443
  const usarHttps = mode === 'https'
  const hayCertificado = existsSync(CERT) && existsSync(CLAVE)
  // Dirección del backend de Django (se puede cambiar con BACKEND_URL en un archivo .env)
  const backend = env.BACKEND_URL || (usarHttps ? 'https://127.0.0.1:8443' : 'http://127.0.0.1:8000')

  // El frontend le pide la API a su propio servidor (/api, /media) y Vite se la pasa a Django.
  // Así todo queda en el mismo origen: las cookies no viajan a otros sitios (CSRF) y,
  // con https, Django sabe que la conexión es segura gracias a X-Forwarded-Proto (xfwd).
  const proxy = Object.fromEntries(
    // secure: false porque el certificado de desarrollo es autofirmado (solo entre Vite y Django, en tu equipo)
    ['/api', '/media', '/static'].map(ruta => [ruta, { target: backend, xfwd: true, secure: false }])
  )

  return {
    // Si no existe certs/, se usa un certificado temporal de Vite
    plugins: [react(), cspEnProduccion(), ...(usarHttps && !hayCertificado ? [basicSsl()] : [])],
    server: {
      port: 5173,
      proxy,
      https: usarHttps && hayCertificado ? { cert: readFileSync(CERT), key: readFileSync(CLAVE) } : undefined,
    },
    preview: {
      port: 4173,
      proxy,
      headers: {
        'Content-Security-Policy': `${CSP}; frame-ancestors 'none'`,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  }
})
