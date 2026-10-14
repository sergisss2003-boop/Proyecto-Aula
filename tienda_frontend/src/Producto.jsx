import { useState } from 'react'

export const tallasDe = (producto) =>
  (producto.talla || '').split(',').map(t => t.trim()).filter(Boolean)

function Producto({ producto, categoria, relacionados, formatoPrecio, enCarrito, onAgregar, onComprarAhora }) {
  const tallas = tallasDe(producto)
  const [talla, setTalla] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [error, setError] = useState('')

  const disponible = Math.max(producto.stock - enCarrito, 0)
  const sinStock = producto.stock === 0

  const validar = () => {
    if (tallas.length > 0 && !talla) {
      setError('Selecciona una talla')
      return false
    }
    return true
  }

  const agregar = () => {
    if (!validar()) return
    onAgregar(producto, talla, cantidad)
    setCantidad(1)
  }

  const comprarAhora = () => {
    if (!validar()) return
    onComprarAhora(producto, talla, cantidad)
    setCantidad(1)
  }

  const cambiarCantidad = (delta) => setCantidad(c => Math.min(Math.max(c + delta, 1), Math.max(disponible, 1)))

  return (
    <section className="detalle-wrap">
      <nav className="migas" aria-label="Ruta de navegación">
        <a href="#">Inicio</a>
        <span>/</span>
        {categoria && <><a href="#catalogo">{categoria.nombre}</a><span>/</span></>}
        <strong>{producto.nombre}</strong>
      </nav>

      <div className="detalle">
        <div className="detalle-imagen">
          {producto.imagen
            ? <img src={producto.imagen} alt={producto.nombre} />
            : <span className="sin-imagen">{producto.nombre.charAt(0)}</span>}
        </div>

        <div className="detalle-info">
          {categoria && <p className="detalle-categoria">{categoria.nombre}</p>}
          <h1>{producto.nombre}</h1>
          <p className="detalle-precio">{formatoPrecio(producto.precio)}</p>

          {producto.descripcion && <p className="detalle-descripcion">{producto.descripcion}</p>}
          {producto.color && <p className="detalle-dato"><strong>Color:</strong> {producto.color}</p>}

          {tallas.length > 0 && (
            <div className="detalle-tallas">
              <p className="detalle-etiqueta">TALLA {talla && <strong>{talla}</strong>}</p>
              <div className="tallas">
                {tallas.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={talla === t ? 'activa' : ''}
                    onClick={() => { setTalla(t); setError('') }}
                    disabled={sinStock}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {error && <small className="campo-error">{error}</small>}
            </div>
          )}

          {sinStock ? (
            <p className="detalle-agotado">Producto agotado</p>
          ) : (
            <>
              <div className="detalle-acciones">
                <div className="carrito-cantidad cantidad-grande">
                  <button onClick={() => cambiarCantidad(-1)} disabled={cantidad <= 1}>−</button>
                  <span>{cantidad}</span>
                  <button onClick={() => cambiarCantidad(1)} disabled={cantidad >= disponible}>+</button>
                </div>
                <button className="btn-agregar-grande" onClick={agregar} disabled={disponible === 0}>
                  Agregar al carrito
                </button>
              </div>
              <button className="btn-comprar-ahora" onClick={comprarAhora} disabled={disponible === 0}>
                Comprar ahora
              </button>
              {disponible === 0 && <p className="nota">Ya tienes en tu carrito todas las unidades disponibles.</p>}
              {producto.stock <= 5 && <p className="detalle-pocas">¡Quedan solo {producto.stock} unidades!</p>}
            </>
          )}
        </div>
      </div>

      {relacionados.length > 0 && (
        <div className="relacionados">
          <h2>También te puede gustar</h2>
          <div className="productos">
            {relacionados.map(p => (
              <a className="producto producto-link" key={p.id} href={`#/producto/${p.id}`}>
                <div className="producto-imagen">
                  {p.imagen ? <img src={p.imagen} alt={p.nombre} /> : <span className="sin-imagen">{p.nombre.charAt(0)}</span>}
                </div>
                <div className="producto-info">
                  <h3>{p.nombre}</h3>
                  <span className="precio">{formatoPrecio(p.precio)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default Producto
