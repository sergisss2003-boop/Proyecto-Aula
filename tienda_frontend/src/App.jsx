import { useState, useEffect } from 'react'
import axios from 'axios'
import Checkout from './Checkout'
import Admin from './Admin'
import Login from './Login'
import Producto, { tallasDe } from './Producto'
import './App.css'

const API_URL = 'http://127.0.0.1:8000/api'

const quitarTildes = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function Icono({ children }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

function App() {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)
  const [carrito, setCarrito] = useState(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem('carrito')) || []
      return guardado.map(item => ({
        ...item,
        talla: item.talla ?? '',
        clave: item.clave ?? `${item.id}-${item.talla ?? ''}`,
      }))
    } catch {
      return []
    }
  })
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [checkoutAbierto, setCheckoutAbierto] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('carrito', JSON.stringify(carrito))
    } catch {
      // si el navegador bloquea el almacenamiento, el carrito sigue funcionando en memoria
    }
  }, [carrito])

  // --- Sesión del administrador (se guarda solo mientras la pestaña esté abierta) ---
  const [sesion, setSesion] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('sesionAdmin'))
    } catch {
      return null
    }
  })
  const [loginAbierto, setLoginAbierto] = useState(false)
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false)

  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const alCambiarHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', alCambiarHash)
    return () => window.removeEventListener('hashchange', alCambiarHash)
  }, [])

  // El panel solo se muestra si hay una sesión de administrador iniciada
  const coincideProducto = hash.match(/^#\/producto\/(\d+)$/)
  const productoId = coincideProducto ? Number(coincideProducto[1]) : null
  const vista = hash === '#/admin' && sesion ? 'admin' : productoId ? 'producto' : 'tienda'

  // Al abrir un producto, la página vuelve arriba
  useEffect(() => {
    if (productoId) window.scrollTo(0, 0)
  }, [productoId])

  // Si alguien entra a #/admin sin haber iniciado sesión, se le pide el login
  useEffect(() => {
    if (hash === '#/admin' && !sesion) setLoginAbierto(true)
  }, [hash, sesion])

  const iniciarSesion = (datos) => {
    try {
      sessionStorage.setItem('sesionAdmin', JSON.stringify(datos))
    } catch {
      // sin almacenamiento, la sesión dura mientras no se recargue la página
    }
    setSesion(datos)
    setLoginAbierto(false)
    setMenuUsuarioAbierto(false)
    window.location.hash = '#/admin'
  }

  const cerrarSesion = () => {
    try {
      sessionStorage.removeItem('sesionAdmin')
    } catch {
      // nada que limpiar
    }
    setSesion(null)
    setMenuUsuarioAbierto(false)
    window.location.hash = ''
  }

  // --- Buscador ---
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Cada vez que se vuelve a la tienda se recargan los datos, para reflejar lo hecho en el panel
  useEffect(() => {
    if (vista === 'admin') return
    axios.get(`${API_URL}/categorias/`)
      .then(response => setCategorias(response.data))
      .catch(error => console.error('Error cargando categorias:', error))

    axios.get(`${API_URL}/productos/`)
      .then(response => setProductos(response.data))
      .catch(error => console.error('Error cargando productos:', error))
  }, [vista])

  // Los productos marcados como "inactivo" en el panel no se muestran en la tienda
  const productosActivos = productos.filter(p => p.estado !== 'inactivo')
  const porCategoria = categoriaSeleccionada
    ? productosActivos.filter(p => p.categoria === categoriaSeleccionada)
    : productosActivos
  const textoBusqueda = quitarTildes(busqueda.trim())
  const productosFiltrados = textoBusqueda
    ? porCategoria.filter(p => quitarTildes(`${p.nombre} ${p.descripcion}`).includes(textoBusqueda))
    : porCategoria

  // --- Carrito ---
  // Cada línea del carrito se identifica por producto + talla; el stock se comparte entre todas las tallas del producto
  const unidadesDelProducto = (id, exceptoClave = null) =>
    carrito.filter(i => i.id === id && i.clave !== exceptoClave).reduce((suma, i) => suma + i.cantidad, 0)

  const maximoPara = (item) => item.stock - unidadesDelProducto(item.id, item.clave)

  const agregarAlCarrito = (prod, talla = '', cantidad = 1) => {
    const clave = `${prod.id}-${talla}`
    setCarrito(actual => {
      const yaEnCarrito = actual.filter(i => i.id === prod.id).reduce((suma, i) => suma + i.cantidad, 0)
      const disponible = prod.stock - yaEnCarrito
      if (disponible <= 0) return actual
      const agregar = Math.min(cantidad, disponible)
      const existente = actual.find(i => i.clave === clave)
      if (existente) {
        return actual.map(i => (i.clave === clave ? { ...i, cantidad: i.cantidad + agregar } : i))
      }
      return [...actual, {
        clave,
        id: prod.id,
        nombre: prod.nombre,
        talla,
        precio: Number(prod.precio),
        imagen: prod.imagen,
        stock: prod.stock,
        cantidad: agregar,
      }]
    })
    setCarritoAbierto(true)
  }

  const comprarAhora = (prod, talla, cantidad) => {
    agregarAlCarrito(prod, talla, cantidad)
    setCarritoAbierto(false)
    setCheckoutAbierto(true)
  }

  const cambiarCantidad = (clave, delta) => {
    setCarrito(actual => {
      const objetivo = actual.find(i => i.clave === clave)
      if (!objetivo) return actual
      const otras = actual
        .filter(i => i.id === objetivo.id && i.clave !== clave)
        .reduce((suma, i) => suma + i.cantidad, 0)
      const maximo = objetivo.stock - otras
      return actual.map(i =>
        i.clave === clave ? { ...i, cantidad: Math.min(Math.max(i.cantidad + delta, 1), maximo) } : i
      )
    })
  }

  const quitarDelCarrito = (clave) => {
    setCarrito(actual => actual.filter(item => item.clave !== clave))
  }

  const vaciarCarrito = () => setCarrito([])

  const abrirCheckout = () => {
    setCarritoAbierto(false)
    setCheckoutAbierto(true)
  }

  const finalizarCompra = () => {
    setCarrito([])
    setCheckoutAbierto(false)
  }

  const totalItems = carrito.reduce((suma, item) => suma + item.cantidad, 0)
  const totalCarrito = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0)
  const formatoPrecio = (valor) => `$${Number(valor).toLocaleString('es-CO')}`

  const irAlCatalogo = () => {
    const seccion = document.getElementById('catalogo')
    if (seccion) {
      seccion.scrollIntoView({ behavior: 'smooth' })
    } else {
      // estamos en la página de un producto: volvemos al catálogo
      window.location.hash = '#catalogo'
      setTimeout(() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const cambiarBusqueda = (e) => {
    const valor = e.target.value
    if (busqueda === '' && valor !== '') irAlCatalogo()
    setBusqueda(valor)
  }

  const cerrarBuscador = () => {
    setBuscadorAbierto(false)
    setBusqueda('')
  }

  if (vista === 'admin') {
    return <Admin apiUrl={API_URL} token={sesion.token} usuario={sesion.usuario} onSalir={cerrarSesion} />
  }

  return (
    <div className="tienda">
      <nav className="navbar">
        <span
          className="logo"
          onClick={() => {
            setCategoriaSeleccionada(null)
            setBusqueda('')
            window.location.hash = ''
          }}
        >
          STUDIO SD
        </span>
        <div className="nav-links">
          {categorias.map(cat => (
            <a
              key={cat.id}
              href="#catalogo"
              className={categoriaSeleccionada === cat.id ? 'activo' : ''}
              onClick={() => setCategoriaSeleccionada(cat.id)}
            >
              {cat.nombre}
            </a>
          ))}
          <div className="nav-iconos">
            <button className="icono-btn" onClick={() => setBuscadorAbierto(!buscadorAbierto)} aria-label="Buscar productos">
              <Icono><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Icono>
            </button>

            <div className="usuario-wrap">
              <button
                className="icono-btn"
                onClick={() => (sesion ? setMenuUsuarioAbierto(!menuUsuarioAbierto) : setLoginAbierto(true))}
                aria-label={sesion ? 'Menú de administrador' : 'Iniciar sesión'}
              >
                <Icono><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Icono>
                {sesion && <span className="punto-sesion" />}
              </button>
              {sesion && menuUsuarioAbierto && (
                <div className="menu-usuario">
                  <p>Hola, <strong>{sesion.usuario}</strong></p>
                  <a href="#/admin" onClick={() => setMenuUsuarioAbierto(false)}>Panel de administración</a>
                  <button onClick={cerrarSesion}>Cerrar sesión</button>
                </div>
              )}
            </div>

            <button className="icono-btn cart-icon" onClick={() => setCarritoAbierto(true)} aria-label="Abrir carrito">
              <Icono><path d="M6 7h12l1 14H5L6 7z" /><path d="M9 7a3 3 0 016 0" /></Icono>
              {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
            </button>
          </div>
        </div>
      </nav>

      {buscadorAbierto && (
        <div className="buscador">
          <input
            autoFocus
            value={busqueda}
            onChange={cambiarBusqueda}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cerrarBuscador()
              if (e.key === 'Enter') irAlCatalogo()
            }}
            placeholder="Buscar productos..."
            aria-label="Buscar productos"
          />
          <button onClick={cerrarBuscador} aria-label="Cerrar buscador">✕</button>
        </div>
      )}

      {vista === 'producto' ? (
        (() => {
          const prod = productosActivos.find(p => p.id === productoId)
          if (!prod) {
            return (
              <p className="vacio detalle-vacio">
                {productos.length === 0 ? 'Cargando producto...' : 'No encontramos este producto.'}{' '}
                <a href="#">Volver a la tienda</a>
              </p>
            )
          }
          return (
            <Producto
              key={prod.id}
              producto={prod}
              categoria={categorias.find(c => c.id === prod.categoria)}
              relacionados={productosActivos.filter(p => p.categoria === prod.categoria && p.id !== prod.id).slice(0, 4)}
              formatoPrecio={formatoPrecio}
              enCarrito={unidadesDelProducto(prod.id)}
              onAgregar={agregarAlCarrito}
              onComprarAhora={comprarAhora}
            />
          )
        })()
      ) : (
      <>
      <header className="hero">
        <h1>Nueva colección</h1>
        <p>Ropa y accesorios con actitud, para cada estilo.</p>
        <button className="hero-btn" onClick={irAlCatalogo}>Ver catálogo</button>
      </header>

      <section id="catalogo" className="catalogo-section">
        {textoBusqueda && (
          <p className="resultados">
            {productosFiltrados.length} resultado(s) para “{busqueda.trim()}”
          </p>
        )}
        <div className="productos">
          {productosFiltrados.map(prod => (
            <div className="producto" key={prod.id}>
              <a className="producto-imagen" href={`#/producto/${prod.id}`}>
                {prod.imagen
                  ? <img src={prod.imagen} alt={prod.nombre} />
                  : <span className="sin-imagen">{prod.nombre.charAt(0)}</span>
                }
              </a>
              <div className="producto-info">
                <h3><a className="producto-titulo" href={`#/producto/${prod.id}`}>{prod.nombre}</a></h3>
                <p className="descripcion">{prod.descripcion}</p>
                <div className="producto-footer">
                  <span className="precio">${Number(prod.precio).toLocaleString('es-CO')}</span>
                  {tallasDe(prod).length > 0 ? (
                    <a className="btn-agregar" href={`#/producto/${prod.id}`}>
                      {prod.stock === 0 ? 'Agotado' : 'Ver tallas'}
                    </a>
                  ) : (
                    <button
                      className="btn-agregar"
                      onClick={() => agregarAlCarrito(prod)}
                      disabled={prod.stock === 0}
                    >
                      {prod.stock === 0 ? 'Agotado' : 'Agregar'}
                    </button>
                  )}
                </div>
                <p className="stock">Stock disponible: {prod.stock}</p>
              </div>
            </div>
          ))}
        </div>

        {productosFiltrados.length === 0 && (
          <p className="vacio">
            {textoBusqueda ? 'No encontramos productos con esa búsqueda.' : 'No hay productos en esta categoría.'}
          </p>
        )}
      </section>
      </>
      )}

      <footer className="footer">
        <div className="footer-top">
          <div className="footer-col">
            <h4>¡Sé parte de Studio SD!</h4>
            <p>Recibe novedades y promociones antes que nadie.</p>
            <div className="newsletter">
              <input type="email" placeholder="Dirección de correo electrónico" />
              <button>Suscribirse</button>
            </div>
          </div>

          <div className="footer-col">
            <h5>Categorías</h5>
            <ul>
              {categorias.map(cat => (
                <li key={cat.id}>{cat.nombre}</li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h5>Servicio al cliente</h5>
            <ul>
              <li>Preguntas frecuentes</li>
              <li>Política de privacidad</li>
              <li>Políticas de envío y devolución</li>
              <li>Contáctanos</li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Información</h5>
            <p>Horario: Lunes a viernes, 8:00 am - 6:00 pm</p>
            <p>Correo: contacto@studiosd.co</p>
            <div className="footer-social">
              <span>📷</span>
              <span>📘</span>
              <span>🎵</span>
            </div>
          </div>
        </div>

        <div className="footer-brand">STUDIO SD</div>
      </footer>

      {carritoAbierto && <div className="overlay" onClick={() => setCarritoAbierto(false)} />}
      <aside className={`carrito-panel ${carritoAbierto ? 'abierto' : ''}`}>
        <div className="carrito-header">
          <h2>Tu carrito ({totalItems})</h2>
          <button className="carrito-cerrar" onClick={() => setCarritoAbierto(false)} aria-label="Cerrar carrito">✕</button>
        </div>

        {carrito.length === 0 ? (
          <p className="carrito-vacio">Tu carrito está vacío.</p>
        ) : (
          <>
            <ul className="carrito-lista">
              {carrito.map(item => (
                <li className="carrito-item" key={item.clave}>
                  <div className="carrito-img">
                    {item.imagen
                      ? <img src={item.imagen} alt={item.nombre} />
                      : <span>{item.nombre.charAt(0)}</span>
                    }
                  </div>
                  <div className="carrito-datos">
                    <p className="carrito-nombre">{item.nombre}</p>
                    {item.talla && <p className="carrito-talla">Talla: {item.talla}</p>}
                    <p className="carrito-precio">{formatoPrecio(item.precio)}</p>
                    <div className="carrito-cantidad">
                      <button onClick={() => cambiarCantidad(item.clave, -1)} disabled={item.cantidad <= 1}>−</button>
                      <span>{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.clave, 1)} disabled={item.cantidad >= maximoPara(item)}>+</button>
                    </div>
                  </div>
                  <div className="carrito-lado">
                    <span className="carrito-subtotal">{formatoPrecio(item.precio * item.cantidad)}</span>
                    <button className="carrito-quitar" onClick={() => quitarDelCarrito(item.clave)}>Quitar</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="carrito-footer">
              <div className="carrito-total">
                <span>Total</span>
                <strong>{formatoPrecio(totalCarrito)}</strong>
              </div>
              <button className="btn-finalizar" onClick={abrirCheckout}>Finalizar compra</button>
              <button className="btn-vaciar" onClick={vaciarCarrito}>Vaciar carrito</button>
            </div>
          </>
        )}
      </aside>

      {loginAbierto && (
        <Login
          apiUrl={API_URL}
          onCerrar={() => setLoginAbierto(false)}
          onExito={iniciarSesion}
        />
      )}

      {checkoutAbierto && (
        <Checkout
          items={carrito}
          subtotal={totalCarrito}
          formatoPrecio={formatoPrecio}
          onCerrar={() => setCheckoutAbierto(false)}
          onFinalizar={finalizarCompra}
        />
      )}
    </div>
  )
}

export default App