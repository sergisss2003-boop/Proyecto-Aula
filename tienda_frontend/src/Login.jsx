import { useState } from 'react'
import axios from 'axios'

function Login({ apiUrl, onCerrar, onExito }) {
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    if (!usuario.trim() || !clave) {
      setError('Escribe tu usuario y tu contraseña')
      return
    }
    setEnviando(true)
    setError('')
    try {
      const { data } = await axios.post(`${apiUrl}/login/`, { username: usuario.trim(), password: clave })
      onExito({ token: data.token, usuario: data.usuario })
    } catch (err) {
      if (err.response?.status === 403) setError(err.response.data?.detail || 'No tienes permisos de administrador')
      else if (err.response?.status === 400) setError('Usuario o contraseña incorrectos')
      else if (err.response?.status === 429) setError('Demasiados intentos. Espera un minuto e inténtalo de nuevo.')
      else if (err.response) setError(`El servidor respondió con error ${err.response.status}`)
      else setError('No se pudo conectar con el servidor. ¿Está encendido el backend?')
      setEnviando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-login" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Iniciar sesión</h3>
          <button className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <p className="nota">Acceso exclusivo para administradores de la tienda.</p>
        <form onSubmit={entrar} noValidate>
          <label className="campo">
            <span>Usuario</span>
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="campo">
            <span>Contraseña</span>
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <div className="aviso aviso-error">{error}</div>}
          <button type="submit" className="btn-principal btn-ancho" disabled={enviando}>
            {enviando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
