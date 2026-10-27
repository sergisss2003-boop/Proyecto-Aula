import { useEffect, useState } from 'react'
import { api, mensajeDeError } from './api'

const ESTADOS = { recibido: 'Recibido', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' }

// Lista de pedidos: el cliente ve solo los suyos y el administrador ve todos (lo decide el servidor)
function MisPedidos({ sesion, esAdmin, formatoPrecio, onPedirLogin }) {
  const [pedidos, setPedidos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sesion) return
    api.get('/pedidos/')
      .then(({ data }) => setPedidos(data))
      .catch(err => setError(mensajeDeError(err, 'No pudimos cargar tus pedidos.')))
  }, [sesion])

  return (
    <section className="mis-pedidos">
      <h1>{esAdmin ? 'Todos los pedidos' : 'Mis pedidos'}</h1>

      {!sesion ? (
        <div className="mis-pedidos-vacio">
          <p>Inicia sesión para ver tus pedidos.</p>
          <button className="btn-principal" onClick={onPedirLogin}>Iniciar sesión</button>
        </div>
      ) : error ? (
        <p className="aviso aviso-error">{error}</p>
      ) : pedidos === null ? (
        <p className="nota">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <div className="mis-pedidos-vacio">
          <p>Todavía no tienes pedidos.</p>
          <a className="btn-principal" href="#catalogo">Ir al catálogo</a>
        </div>
      ) : (
        <ul className="pedidos-lista">
          {pedidos.map(p => (
            <li key={p.id} className="pedido-tarjeta">
              <div className="pedido-cabecera">
                <div>
                  <strong>{p.numero}</strong>
                  <small>{new Date(p.creado).toLocaleString('es-CO')}{esAdmin && ` · ${p.cliente_email}`}</small>
                </div>
                <span className={`pedido-estado estado-${p.estado}`}>{ESTADOS[p.estado] ?? p.estado}</span>
              </div>
              <ul className="resumen-lista">
                {p.detalle.map((d, i) => (
                  <li key={i}>
                    <span>{d.cantidad} × {d.nombre}{d.talla ? ` (Talla ${d.talla})` : ''}</span>
                    <span>{formatoPrecio(d.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="pedido-pie">
                <span>Entrega: {p.ciudad}, {p.departamento}</span>
                <strong>Total {formatoPrecio(p.total)}</strong>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default MisPedidos
