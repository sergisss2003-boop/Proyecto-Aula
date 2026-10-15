import { useState, useEffect } from 'react'
import axios from 'axios'
import Checkout from './Checkout'
import Admin from './Admin'
import Login from './Login'
import Producto, { tallasDe } from './Producto'
import Info from './Info'
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
  const coincideInfo = hash.match(/^#\/info\/([a-z-]+)$/)
  const seccionInfo = coincideInfo ? coincideInfo[1] : null
  const vista = hash === '#/admin' && sesion
    ? 'admin'
    : productoId ? 'producto' : seccionInfo ? 'info' : 'tienda'

  // Al abrir un producto o una página de ayuda, la página vuelve arriba
  useEffect(() => {
    if (productoId || seccionInfo) window.scrollTo(0, 0)
  }, [productoId, seccionInfo])

  // --- Boletín del pie de página ---
  const [correoBoletin, setCorreoBoletin] = useState('')
  const [mensajeBoletin, setMensajeBoletin] = useState(null)
  const suscribirse = (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(correoBoletin.trim())) {
      setMensajeBoletin({ ok: false, texto: 'Escribe un correo válido.' })
      return
    }
    setMensajeBoletin({ ok: true, texto: '¡Listo! Ya eres parte de Studio SD.' })
    setCorreoBoletin('')
  }

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

  // Imágenes de la portada: los productos más recientes que tengan foto
  const conImagen = productosActivos.filter(p => p.imagen)
  const destacados = [...conImagen].sort((a, b) => b.id - a.id).slice(0, 3)
  const imagenDeCategoria = (catId) => conImagen.find(p => p.categoria === catId)?.imagen
  const imagenBanner = conImagen.length ? conImagen[conImagen.length - 1].imagen : null

  const elegirCategoria = (id) => {
    setCategoriaSeleccionada(id)
    setBusqueda('')
  }

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
      ) : vista === 'info' ? (
        <Info seccion={seccionInfo} />
      ) : (
      <>
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-texto">
            <span className="hero-etiqueta">Nueva colección</span>
            <h1>Viste con actitud,<br />a tu manera.</h1>
            <p>Ropa y accesorios para cada estilo. Descubre las últimas prendas que acaban de llegar a Studio SD.</p>
            <div className="hero-botones">
              <button className="hero-btn" onClick={irAlCatalogo}>Ver catálogo</button>
              <a className="hero-btn-sec" href="#/info/envios-y-devoluciones">Envío gratis desde $300.000</a>
            </div>
          </div>
          {destacados.length > 0 && (
            <div className="hero-collage">
              {destacados.map(prod => (
                <a className="collage-card" key={prod.id} href={`#/producto/${prod.id}`}>
                  <img src={prod.imagen} alt={prod.nombre} />
                  <span className="collage-info">
                    <strong>{prod.nombre}</strong>
                    <small>{formatoPrecio(prod.precio)}</small>
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="beneficios">
        <div className="beneficio">
          <Icono><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></Icono>
          <div><strong>Envío gratis</strong><span>En compras desde $300.000</span></div>
        </div>
        <div className="beneficio">
          <Icono><path d="M4 12a8 8 0 0114-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 01-14 5.3L4 15" /><path d="M4 20v-5h5" /></Icono>
          <div><strong>Cambios en 30 días</strong><span>Sin complicaciones</span></div>
        </div>
        <div className="beneficio">
          <Icono><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></Icono>
          <div><strong>Pago seguro</strong><span>Tarjeta crédito o débito</span></div>
        </div>
      </section>

      {categorias.length > 0 && (
        <section className="categorias-seccion">
          <h2 className="titulo-seccion">Compra por categoría</h2>
          <div className="categorias-tiles">
            {categorias.map(cat => {
              const img = imagenDeCategoria(cat.id)
              return (
                <a
                  key={cat.id}
                  href="#catalogo"
                  className="tile"
                  style={img ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.05) 60%), url("${img}")` } : undefined}
                  onClick={() => elegirCategoria(cat.id)}
                >
                  <span>{cat.nombre}</span>
                  <small>Ver colección →</small>
                </a>
              )
            })}
          </div>
        </section>
      )}

      <section id="catalogo" className="catalogo-section">
        <h2 className="titulo-seccion">Catálogo</h2>
        <div className="categorias">
          <button className={categoriaSeleccionada === null ? 'activo' : ''} onClick={() => elegirCategoria(null)}>Todo</button>
          {categorias.map(cat => (
            <button key={cat.id} className={categoriaSeleccionada === cat.id ? 'activo' : ''} onClick={() => elegirCategoria(cat.id)}>
              {cat.nombre}
            </button>
          ))}
        </div>
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

      <section
        className="banner-promo"
        style={imagenBanner ? { backgroundImage: `linear-gradient(90deg, rgba(8,8,10,0.85), rgba(8,8,10,0.45)), url("${imagenBanner}")` } : undefined}
      >
        <div>
          <h2>Tu próximo look empieza aquí</h2>
          <p>Compra hoy y recibe envío gratis en pedidos desde $300.000.</p>
        </div>
        <button className="hero-btn" onClick={irAlCatalogo}>Comprar ahora</button>
      </section>
      </>
      )}

      <footer className="footer">
        <div className="footer-top">
          <div className="footer-col">
            <h4>¡Sé parte de Studio SD!</h4>
            <p>Recibe novedades y promociones antes que nadie.</p>
            <form className="newsletter" onSubmit={suscribirse} noValidate>
              <input
                type="email"
                placeholder="Dirección de correo electrónico"
                value={correoBoletin}
                onChange={(e) => { setCorreoBoletin(e.target.value); setMensajeBoletin(null) }}
                aria-label="Correo para el boletín"
              />
              <button type="submit">Suscribirse</button>
            </form>
            {mensajeBoletin && (
              <p className={`boletin-msg ${mensajeBoletin.ok ? 'ok' : 'error'}`}>{mensajeBoletin.texto}</p>
            )}
          </div>

          <div className="footer-col">
            <h5>Categorías</h5>
            <ul>
              {categorias.map(cat => (
                <li key={cat.id}>
                  <a href="#catalogo" onClick={() => elegirCategoria(cat.id)}>{cat.nombre}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h5>Servicio al cliente</h5>
            <ul>
              <li><a href="#/info/preguntas-frecuentes">Preguntas frecuentes</a></li>
              <li><a href="#/info/privacidad">Política de privacidad</a></li>
              <li><a href="#/info/envios-y-devoluciones">Políticas de envío y devolución</a></li>
              <li><a href="#/info/contacto">Contáctanos</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Información</h5>
            <p>Horario: Lunes a viernes, 8:00 am - 6:00 pm</p>
            <p>Correo: <a className="footer-link" href="mailto:contacto@studiosd.co">contacto@studiosd.co</a></p>
            <div className="footer-social">
              <a href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
                <Icono><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.8" /></Icono>
              </a>
              <a href="https://www.facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
                <Icono><path d="M14 8h3V4h-3a4 4 0 00-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" /></Icono>
              </a>
              <a href="https://www.tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok">
                <Icono><path d="M14 3v11a4 4 0 11-4-4" /><path d="M14 3c0 3 2 5 5 5" /></Icono>
              </a>
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