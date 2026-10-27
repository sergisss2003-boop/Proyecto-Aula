import { useState } from 'react'
import { api, mensajeDeError } from './api'

const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
  'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre',
  'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
]

const ENVIOS = {
  estandar: { nombre: 'Envío estándar', detalle: '3 a 5 días hábiles', costo: 12000 },
  express: { nombre: 'Envío express', detalle: '1 a 2 días hábiles', costo: 25000 },
}
const ENVIO_GRATIS_DESDE = 300000

const marcaTarjeta = (numero) => {
  const n = numero.replace(/\s/g, '')
  if (/^4/.test(n)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard'
  if (/^3[47]/.test(n)) return 'American Express'
  return 'Tarjeta'
}

function Campo({ label, error, children }) {
  return (
    <label className="campo">
      <span>{label}</span>
      {children}
      {error && <small className="campo-error">{error}</small>}
    </label>
  )
}

function Checkout({ items, subtotal, formatoPrecio, sesion, onCerrar, onFinalizar, onSesionVencida }) {
  const [paso, setPaso] = useState(1)
  const [procesando, setProcesando] = useState(false)
  const [pedido, setPedido] = useState(null)
  const [errores, setErrores] = useState({})
  const [errorPedido, setErrorPedido] = useState('')

  const [envio, setEnvio] = useState({
    nombre: sesion?.nombre ?? '', email: sesion?.email ?? '', telefono: '', departamento: '', ciudad: '', direccion: '', indicaciones: '',
  })
  const [metodoEnvio, setMetodoEnvio] = useState('estandar')
  const [pago, setPago] = useState({ numero: '', titular: '', vence: '', cvv: '' })

  const costoEnvio =
    metodoEnvio === 'estandar' && subtotal >= ENVIO_GRATIS_DESDE ? 0 : ENVIOS[metodoEnvio].costo
  const total = subtotal + costoEnvio

  const limpiarError = (name) => setErrores(prev => ({ ...prev, [name]: undefined }))

  const cambiarEnvio = (e) => {
    setEnvio(prev => ({ ...prev, [e.target.name]: e.target.value }))
    limpiarError(e.target.name)
  }

  const cambiarPago = (e) => {
    const { name } = e.target
    let valor = e.target.value
    if (name === 'numero') {
      valor = valor.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
    } else if (name === 'vence') {
      const d = valor.replace(/\D/g, '').slice(0, 4)
      valor = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
    } else if (name === 'cvv') {
      valor = valor.replace(/\D/g, '').slice(0, 4)
    }
    setPago(prev => ({ ...prev, [name]: valor }))
    limpiarError(name)
  }

  const validarEnvio = () => {
    const err = {}
    if (envio.nombre.trim().length < 3) err.nombre = 'Escribe tu nombre completo'
    if (!/^\S+@\S+\.\S+$/.test(envio.email)) err.email = 'Correo no válido'
    if (!/^\d{10}$/.test(envio.telefono.replace(/\s/g, ''))) err.telefono = 'Debe tener 10 dígitos'
    if (!envio.departamento) err.departamento = 'Selecciona un departamento'
    if (envio.ciudad.trim().length < 2) err.ciudad = 'Escribe la ciudad'
    if (envio.direccion.trim().length < 5) err.direccion = 'Escribe la dirección de entrega'
    setErrores(err)
    return Object.keys(err).length === 0
  }

  const validarPago = () => {
    const err = {}
    if (pago.numero.replace(/\s/g, '').length !== 16) err.numero = 'Debe tener 16 dígitos'
    if (pago.titular.trim().length < 3) err.titular = 'Escribe el nombre como aparece en la tarjeta'
    const m = pago.vence.match(/^(\d{2})\/(\d{2})$/)
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) {
      err.vence = 'Usa el formato MM/AA'
    } else {
      const finMes = new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59, 59)
      if (finMes < new Date()) err.vence = 'La tarjeta está vencida'
    }
    if (pago.cvv.length < 3) err.cvv = 'CVV no válido'
    setErrores(err)
    return Object.keys(err).length === 0
  }

  const continuarAPago = (e) => {
    e.preventDefault()
    if (validarEnvio()) setPaso(2)
  }

  const pagar = async (e) => {
    e.preventDefault()
    if (!validarPago()) return
    setProcesando(true)
    setErrorPedido('')
    // Pago simulado: no se contacta ninguna pasarela. Al servidor solo viajan la marca y los
    // últimos 4 dígitos de la tarjeta (nunca el número completo ni el CVV).
    // Tampoco se envían precios ni totales: el servidor los calcula con su base de datos.
    try {
      const { data } = await api.post('/pedidos/', {
        ...envio,
        telefono: envio.telefono.replace(/\s/g, ''),
        metodo_envio: metodoEnvio,
        tarjeta_marca: marcaTarjeta(pago.numero),
        tarjeta_ultimos4: pago.numero.replace(/\s/g, '').slice(-4),
        items: items.map(item => ({ producto: item.id, talla: item.talla, cantidad: item.cantidad })),
      })
      setPedido({
        numero: data.numero,
        fecha: new Date(data.creado).toLocaleString('es-CO'),
        items: data.detalle.map((d, i) => ({ clave: i, nombre: d.nombre, talla: d.talla, cantidad: d.cantidad, total: Number(d.subtotal) })),
        envio: { ...envio },
        metodo: ENVIOS[data.metodo_envio],
        subtotal: Number(data.subtotal),
        costoEnvio: Number(data.costo_envio),
        total: Number(data.total),
        tarjeta: { marca: data.tarjeta_marca, ultimos4: data.tarjeta_ultimos4 },
      })
      setPaso(3)
    } catch (err) {
      if (err.response?.status === 401) return onSesionVencida()
      const datos = err.response?.data
      const detalle = datos && typeof datos === 'object' ? Object.values(datos).flat().join(' ') : ''
      setErrorPedido(detalle || mensajeDeError(err, 'No pudimos registrar tu pedido.'))
    } finally {
      setProcesando(false)
    }
  }

  const cerrar = () => (paso === 3 ? onFinalizar() : onCerrar())

  return (
    <div className="checkout-overlay">
      <div className="checkout">
        <button className="checkout-cerrar" onClick={cerrar} aria-label="Cerrar">✕</button>

        <div className="pasos">
          <span className={paso >= 1 ? 'activo' : ''}>1. Envío</span>
          <span className={paso >= 2 ? 'activo' : ''}>2. Pago</span>
          <span className={paso >= 3 ? 'activo' : ''}>3. Confirmación</span>
        </div>

        {paso === 3 && pedido ? (
          <div className="confirmacion">
            <div className="confirmacion-check">✓</div>
            <h2>¡Gracias por tu compra, {pedido.envio.nombre.split(' ')[0]}!</h2>
            <p>Tu pedido <strong>{pedido.numero}</strong> fue recibido ({pedido.fecha})</p>
            <p>Enviaremos la confirmación a <strong>{pedido.envio.email}</strong>. Puedes verlo en <a href="#/mis-pedidos" onClick={onFinalizar}>Mis pedidos</a>.</p>

            <div className="confirmacion-grid">
              <div>
                <h4>Dirección de entrega</h4>
                <p>
                  {pedido.envio.nombre}<br />
                  {pedido.envio.direccion}<br />
                  {pedido.envio.ciudad}, {pedido.envio.departamento}<br />
                  Tel. {pedido.envio.telefono}
                </p>
                {pedido.envio.indicaciones && <p className="nota">Indicaciones: {pedido.envio.indicaciones}</p>}
              </div>
              <div>
                <h4>Envío y pago</h4>
                <p>
                  {pedido.metodo.nombre} ({pedido.metodo.detalle})<br />
                  {pedido.tarjeta.marca} terminada en {pedido.tarjeta.ultimos4}
                </p>
              </div>
            </div>

            <ul className="resumen-lista">
              {pedido.items.map(item => (
                <li key={item.clave}>
                  <span>{item.cantidad} × {item.nombre}{item.talla ? ` (Talla ${item.talla})` : ''}</span>
                  <span>{formatoPrecio(item.total)}</span>
                </li>
              ))}
            </ul>
            <div className="resumen-linea"><span>Subtotal</span><span>{formatoPrecio(pedido.subtotal)}</span></div>
            <div className="resumen-linea"><span>Envío</span><span>{pedido.costoEnvio === 0 ? 'Gratis' : formatoPrecio(pedido.costoEnvio)}</span></div>
            <div className="resumen-linea total"><span>Total pagado</span><span>{formatoPrecio(pedido.total)}</span></div>

            <button className="btn-principal" onClick={onFinalizar}>Seguir comprando</button>
          </div>
        ) : (
          <div className="checkout-cuerpo">
            <div className="checkout-form">
              {paso === 1 && (
                <form onSubmit={continuarAPago} noValidate>
                  <h2>Datos de envío</h2>
                  <div className="campos-grid">
                    <Campo label="Nombre completo" error={errores.nombre}>
                      <input name="nombre" value={envio.nombre} onChange={cambiarEnvio} autoComplete="name" />
                    </Campo>
                    <Campo label="Correo electrónico" error={errores.email}>
                      <input name="email" type="email" value={envio.email} onChange={cambiarEnvio} autoComplete="email" />
                    </Campo>
                    <Campo label="Teléfono celular" error={errores.telefono}>
                      <input name="telefono" inputMode="numeric" value={envio.telefono} onChange={cambiarEnvio} autoComplete="tel" />
                    </Campo>
                    <Campo label="Departamento" error={errores.departamento}>
                      <select name="departamento" value={envio.departamento} onChange={cambiarEnvio}>
                        <option value="">Selecciona...</option>
                        {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Campo>
                    <Campo label="Ciudad" error={errores.ciudad}>
                      <input name="ciudad" value={envio.ciudad} onChange={cambiarEnvio} />
                    </Campo>
                    <Campo label="Dirección de entrega" error={errores.direccion}>
                      <input name="direccion" value={envio.direccion} onChange={cambiarEnvio} autoComplete="street-address" />
                    </Campo>
                  </div>
                  <Campo label="Indicaciones adicionales (opcional)">
                    <input name="indicaciones" value={envio.indicaciones} onChange={cambiarEnvio} placeholder="Apartamento, torre, punto de referencia..." />
                  </Campo>

                  <h3>Método de envío</h3>
                  {Object.entries(ENVIOS).map(([clave, op]) => {
                    const gratis = clave === 'estandar' && subtotal >= ENVIO_GRATIS_DESDE
                    return (
                      <label key={clave} className={`opcion-envio ${metodoEnvio === clave ? 'seleccionada' : ''}`}>
                        <input type="radio" name="metodoEnvio" checked={metodoEnvio === clave} onChange={() => setMetodoEnvio(clave)} />
                        <div>
                          <strong>{op.nombre}</strong>
                          <small>{op.detalle}</small>
                        </div>
                        <span>{gratis ? 'Gratis' : formatoPrecio(op.costo)}</span>
                      </label>
                    )
                  })}
                  <p className="nota">Envío estándar gratis en compras desde {formatoPrecio(ENVIO_GRATIS_DESDE)}.</p>

                  <button type="submit" className="btn-principal">Continuar al pago</button>
                </form>
              )}

              {paso === 2 && (
                <form onSubmit={pagar} noValidate>
                  <h2>Pago con tarjeta</h2>
                  <p className="nota">Entorno de demostración: no se realiza ningún cobro real ni se guardan los datos de la tarjeta.</p>
                  <Campo label={`Número de tarjeta (${marcaTarjeta(pago.numero)})`} error={errores.numero}>
                    <input name="numero" inputMode="numeric" placeholder="1234 5678 9012 3456" value={pago.numero} onChange={cambiarPago} autoComplete="cc-number" />
                  </Campo>
                  <Campo label="Nombre del titular" error={errores.titular}>
                    <input name="titular" value={pago.titular} onChange={cambiarPago} autoComplete="cc-name" />
                  </Campo>
                  <div className="campos-grid">
                    <Campo label="Vence (MM/AA)" error={errores.vence}>
                      <input name="vence" inputMode="numeric" placeholder="MM/AA" value={pago.vence} onChange={cambiarPago} autoComplete="cc-exp" />
                    </Campo>
                    <Campo label="CVV" error={errores.cvv}>
                      <input name="cvv" type="password" inputMode="numeric" value={pago.cvv} onChange={cambiarPago} autoComplete="cc-csc" />
                    </Campo>
                  </div>

                  {errorPedido && <div className="aviso aviso-error">{errorPedido}</div>}
                  <div className="checkout-botones">
                    <button type="button" className="btn-secundario" onClick={() => { setErrores({}); setErrorPedido(''); setPaso(1) }} disabled={procesando}>Volver</button>
                    <button type="submit" className="btn-principal" disabled={procesando}>
                      {procesando ? 'Procesando pago...' : `Pagar ${formatoPrecio(total)}`}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <aside className="checkout-resumen">
              <h3>Resumen del pedido</h3>
              <ul className="resumen-lista">
                {items.map(item => (
                  <li key={item.clave}>
                    <span>{item.cantidad} × {item.nombre}{item.talla ? ` (Talla ${item.talla})` : ''}</span>
                    <span>{formatoPrecio(item.precio * item.cantidad)}</span>
                  </li>
                ))}
              </ul>
              <div className="resumen-linea"><span>Subtotal</span><span>{formatoPrecio(subtotal)}</span></div>
              <div className="resumen-linea"><span>Envío</span><span>{costoEnvio === 0 ? 'Gratis' : formatoPrecio(costoEnvio)}</span></div>
              <div className="resumen-linea total"><span>Total</span><span>{formatoPrecio(total)}</span></div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

export default Checkout