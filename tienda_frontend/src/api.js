// Cliente único para hablar con el backend de Django.
import axios from 'axios'

export const api = axios.create({
  // La API se pide al mismo servidor del frontend; Vite la pasa a Django (ver vite.config.js)
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Envía la cookie HttpOnly con el token de sesión (JavaScript no puede leerla, el navegador sí la envía)
  withCredentials: true,
  // Protección CSRF (doble envío): axios lee la cookie "csrftoken" y la copia en la cabecera
  // X-CSRFToken en cada POST/PUT/PATCH/DELETE. Otra página web no puede leer esa cookie.
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withXSRFToken: true,
})

// Crea la cookie csrftoken. Se llama al cargar la tienda y antes de iniciar sesión o registrarse.
export const prepararCsrf = () => api.get('/auth/csrf/')

// Mensaje de error legible a partir de la respuesta del servidor
export function mensajeDeError(error, porDefecto = 'Ocurrió un error. Inténtalo de nuevo.') {
  const r = error.response
  if (!r) return 'No se pudo conectar con el servidor. ¿Está encendido el backend?'
  if (r.data?.error) return r.data.error
  if (r.data?.detail) return r.data.detail
  if (r.status === 403) return 'La página venció por seguridad. Recárgala e inténtalo de nuevo.'
  return porDefecto
}
