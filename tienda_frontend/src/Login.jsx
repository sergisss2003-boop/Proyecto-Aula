import { useState } from 'react'
import { api, prepararCsrf, mensajeDeError } from './api'

// Ventana para iniciar sesión o crear una cuenta de cliente
function Login({ onCerrar, onExito, mensaje, modoInicial = 'entrar' }) {
  const [modo, setModo] = useState(modoInicial) // 'entrar' | 'registro'
  const [datos, setDatos] = useState({ nombre: '', email: '', clave: '', clave2: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const registro = modo === 'registro'

  const cambiar = (e) => {
    setDatos({ ...datos, [e.target.name]: e.target.value })
    setError('')
  }

  const cambiarModo = (nuevo) => {
    setModo(nuevo)
    setError('')
  }

  const enviar = async (e) => {
    e.preventDefault()
    // Validaciones rápidas para ayudar al usuario (el servidor vuelve a validar todo)
    if (!datos.email.trim() || !datos.clave) return setError('Escribe tu correo y tu contraseña.')
    if (registro && datos.clave.length < 10) return setError('La contraseña debe tener mínimo 10 caracteres.')
    if (registro && datos.clave !== datos.clave2) return setError('Las contraseñas no coinciden.')

    setEnviando(true)
    try {
      await prepararCsrf()
      const { data } = registro
        ? await api.post('/auth/registro/', { nombre: datos.nombre.trim(), email: datos.email.trim(), clave: datos.clave })
        : await api.post('/auth/login/', { email: datos.email.trim(), clave: datos.clave })
      onExito(data)
    } catch (err) {
      setError(mensajeDeError(err))
      setEnviando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-login" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{registro ? 'Crear cuenta' : 'Iniciar sesión'}</h3>
          <button className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div className="acceso-pestanas">
          <button type="button" className={!registro ? 'activo' : ''} onClick={() => cambiarModo('entrar')}>Iniciar sesión</button>
          <button type="button" className={registro ? 'activo' : ''} onClick={() => cambiarModo('registro')}>Crear cuenta</button>
        </div>

        {mensaje && <p className="nota">{mensaje}</p>}

        <form onSubmit={enviar} noValidate>
          {registro && (
            <label className="campo">
              <span>Nombre</span>
              <input name="nombre" value={datos.nombre} onChange={cambiar} autoComplete="name" maxLength={150} />
            </label>
          )}
          <label className="campo">
            <span>{registro ? 'Correo electrónico' : 'Correo o usuario'}</span>
            <input name="email" type={registro ? 'email' : 'text'} value={datos.email} onChange={cambiar} autoComplete={registro ? 'email' : 'username'} autoFocus />
          </label>
          <label className="campo">
            <span>Contraseña{registro && ' (mínimo 10 caracteres)'}</span>
            <input name="clave" type="password" value={datos.clave} onChange={cambiar} autoComplete={registro ? 'new-password' : 'current-password'} />
          </label>
          {registro && (
            <label className="campo">
              <span>Repite la contraseña</span>
              <input name="clave2" type="password" value={datos.clave2} onChange={cambiar} autoComplete="new-password" />
            </label>
          )}
          {error && <div className="aviso aviso-error">{error}</div>}
          <button type="submit" className="btn-principal btn-ancho" disabled={enviando}>
            {enviando ? 'Un momento...' : registro ? 'Crear mi cuenta' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
