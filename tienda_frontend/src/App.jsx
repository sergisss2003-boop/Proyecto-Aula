import { useState, useEffect } from 'react'
import { api, prepararCsrf } from './api'
import Checkout from './Checkout'
import Admin from './Admin'
import Login from './Login'
import Producto, { Precio, EtiquetaDescuento } from './Producto'
import { tallasDe, descuentoDe } from './utils/producto'
import Info from './Info'
import MisPedidos from './MisPedidos'


const quitarTildes = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// La categoría "Descuentos" es especial: muestra sola todos los productos que tienen "precio antes"
const esDescuentos = (cat) => !!cat && quitarTildes(cat.nombre.trim()) === 'descuentos'

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
  const [menuAbierto, setMenuAbierto] = useState(null)   // categoría principal cuyo desplegable está abierto
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

  // --- Sesión ---
  // El token va en una cookie HttpOnly que JavaScript NO puede leer (si se colara un script, no podría
  // robarla). Por eso, para saber quién inició sesión se le pregunta al servidor (/auth/yo/).
  const [sesion, setSesion] = useState(null)           // { email, nombre, rol: 'cliente' | 'admin' }
  const [sesionRevisada, setSesionRevisada] = useState(false)
  const [acceso, setAcceso] = useState(null)           // ventana de login abierta: { mensaje, siguiente }
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false)

  useEffect(() => {
    prepararCsrf()
      .then(() => api.get('/auth/yo/'))
      .then(({ data }) => setSesion(data))
      .catch(() => setSesion(null))
      .finally(() => setSesionRevisada(true))
  }, [])

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
  const esAdmin = sesion?.rol === 'admin'
  const vista = hash === '#/admin' && esAdmin
    ? 'admin'
    : hash === '#/mis-pedidos' ? 'pedidos'
    : productoId ? 'producto' : seccionInfo ? 'info' : 'tienda'

  // Al abrir un producto o una página de ayuda, la página vuelve arriba
  useEffect(() => {
    if (productoId || seccionInfo || vista === 'pedidos') window.scrollTo(0, 0)
  }, [productoId, seccionInfo, vista])

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

  // Si alguien entra a #/admin sin ser administrador, se le pide iniciar sesión
  const pideAdmin = hash === '#/admin' && sesionRevisada && !esAdmin
  const datosAcceso = acceso || (pideAdmin
    ? { mensaje: sesion ? 'Esta sección es solo para administradores.' : 'Inicia sesión como administrador.', siguiente: 'admin' }
    : null)
  const cerrarLogin = () => {
    setAcceso(null)
    if (window.location.hash === '#/admin') window.location.hash = ''
  }

  const iniciarSesion = (datos) => {
    const siguiente = datosAcceso?.siguiente
    setSesion(datos)
    setAcceso(null)
    setMenuUsuarioAbierto(false)
    if (siguiente === 'checkout') setCheckoutAbierto(true)
    else if (datos.rol === 'admin' && (siguiente === 'admin' || !siguiente)) window.location.hash = '#/admin'
    else if (siguiente === 'admin') window.location.hash = ''
  }

  const cerrarSesion = () => {
    api.post('/auth/logout/').catch(() => {}).finally(() => {
      setSesion(null)
      setMenuUsuarioAbierto(false)
      window.location.hash = ''
    })
  }

  // --- Buscador ---
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Cada vez que se vuelve a la tienda (o se termina una compra) se recargan los datos
  const [recargas, setRecargas] = useState(0)
  useEffect(() => {
    if (vista === 'admin') return
    api.get('/categorias/')
      .then(response => setCategorias(response.data))
      .catch(error => console.error('Error cargando categorias:', error))

    api.get('/productos/')
      .then(response => setProductos(response.data))
      .catch(error => console.error('Error cargando productos:', error))
  }, [vista, recargas])

  // --- Categorías principales (Mujer, Hombre...) y sus subcategorías (Camisas, Jeans...) ---
  const principales = categorias.filter(c => !c.padre)
  const subcategoriasDe = (id) => categorias.filter(c => c.padre === id)
  // Una categoría principal incluye los productos de todas sus subcategorías
  const idsDe = (id) => [id, ...subcategoriasDe(id).map(c => c.id)]
  const seleccionada = categorias.find(c => c.id === categoriaSeleccionada)
  const principalSeleccionada = seleccionada ? (seleccionada.padre ?? seleccionada.id) : null

  // Los productos marcados como "inactivo" en el panel no se muestran en la tienda
  const productosActivos = productos.filter(p => p.estado !== 'inactivo')
  const enDescuento = (p) => descuentoDe(p) > 0
  const productosDe = (catId) => {
    const cat = categorias.find(c => c.id === catId)
    if (esDescuentos(cat)) {
      return productosActivos.filter(p => enDescuento(p) || idsDe(catId).includes(p.categoria))
    }
    return productosActivos.filter(p => idsDe(catId).includes(p.categoria))
  }
  const porCategoria = categoriaSeleccionada ? productosDe(categoriaSeleccionada) : productosActivos
  const textoBusqueda = quitarTildes(busqueda.trim())
  const productosFiltrados = textoBusqueda
    ? porCategoria.filter(p => quitarTildes(`${p.nombre} ${p.descripcion}`).includes(textoBusqueda))
    : porCategoria

  // Imágenes de la portada: la prenda más reciente con foto de cada categoría principal
  // (Mujer, Hombre, Accesorios). Se saltan tenis y medias para que se vea la ropa.
  const conImagen = productosActivos.filter(p => p.imagen)
  const nuevosPrimero = [...conImagen].sort((a, b) => b.id - a.id)
  const esCalzado = (p) => /tenis|zapat|media|calcet/.test(quitarTildes(categorias.find(c => c.id === p.categoria)?.nombre ?? ''))
  const porPrincipal = principales
    .filter(cat => !esDescuentos(cat))
    .map(cat => nuevosPrimero.find(p => idsDe(cat.id).includes(p.categoria) && !esCalzado(p)))
    .filter(Boolean)
  // Si faltan, se completa con los más recientes
  const destacados = [...porPrincipal, ...nuevosPrimero.filter(p => !porPrincipal.includes(p))].slice(0, 3)
  const imagenDeCategoria = (catId) => productosDe(catId).find(p => p.imagen)?.imagen
  const categoriaDescuentos = principales.find(esDescuentos)
  const imagenBanner = conImagen.length ? conImagen[conImagen.length - 1].imagen : null

  const elegirCategoria = (id) => {
    setCategoriaSeleccionada(id)
    setBusqueda('')
    setMenuAbierto(null)
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

  // Solo un usuario con sesión puede comprar (el servidor también lo exige: 401 sin sesión)
  const pedirLoginParaComprar = (mensaje = 'Inicia sesión o crea una cuenta para finalizar tu compra.') =>
    setAcceso({ mensaje, siguiente: 'checkout' })

  const comprarAhora = (prod, talla, cantidad) => {
    agregarAlCarrito(prod, talla, cantidad)
    setCarritoAbierto(false)
    if (sesion) setCheckoutAbierto(true)
    else pedirLoginParaComprar()
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
    if (sesion) setCheckoutAbierto(true)
    else pedirLoginParaComprar()
  }

  const finalizarCompra = () => {
    setCarrito([])
    setCheckoutAbierto(false)
    setRecargas(n => n + 1)  // el stock cambió
  }

  const sesionVencida = () => {
    setCheckoutAbierto(false)
    setSesion(null)
    pedirLoginParaComprar('Tu sesión venció. Inicia sesión de nuevo para terminar tu compra.')
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
    return <Admin usuario={sesion.nombre} onSalir={cerrarSesion} />
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
          {principales.map(cat => {
            const subs = subcategoriasDe(cat.id)
            const img = imagenDeCategoria(cat.id)
            return (
              <div
                className="nav-item"
                key={cat.id}
                onMouseEnter={() => setMenuAbierto(cat.id)}
                onMouseLeave={() => setMenuAbierto(null)}
              >
                <a
                  href="#catalogo"
                  className={`${principalSeleccionada === cat.id ? 'activo' : ''} ${esDescuentos(cat) ? 'nav-descuentos' : ''}`}
                  onClick={() => elegirCategoria(cat.id)}
                >
                  {cat.nombre}
                </a>
                {subs.length > 0 && menuAbierto === cat.id && (
                  <div className="mega-menu">
                    <div className="mega-inner">
                      <div className="mega-lista">
                        <h4>{cat.nombre}</h4>
                        <ul>
                          {subs.map(sub => (
                            <li key={sub.id}>
                              <a href="#catalogo" onClick={() => elegirCategoria(sub.id)}>{sub.nombre}</a>
                            </li>
                          ))}
                        </ul>
                        <a className="mega-todo" href="#catalogo" onClick={() => elegirCategoria(cat.id)}>
                          Ver todo {cat.nombre} →
                        </a>
                      </div>
                      {img && (
                        <a
                          className="mega-imagen"
                          href="#catalogo"
                          onClick={() => elegirCategoria(cat.id)}
                          style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0) 55%), url("${img}")` }}
                        >
                          <span>Nueva colección {cat.nombre}</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <div className="nav-iconos">
            <button className="icono-btn" onClick={() => setBuscadorAbierto(!buscadorAbierto)} aria-label="Buscar productos">
              <Icono><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Icono>
            </button>

            <div className="usuario-wrap">
              <button
                className="icono-btn"
                onClick={() => (sesion ? setMenuUsuarioAbierto(!menuUsuarioAbierto) : setAcceso({}))}
                aria-label={sesion ? 'Menú de usuario' : 'Iniciar sesión o crear cuenta'}
              >
                <Icono><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Icono>
                {sesion && <span className="punto-sesion" />}
              </button>
              {sesion && menuUsuarioAbierto && (
                <div className="menu-usuario">
                  <p>Hola, <strong>{sesion.nombre}</strong></p>
                  <a href="#/mis-pedidos" onClick={() => setMenuUsuarioAbierto(false)}>{esAdmin ? 'Todos los pedidos' : 'Mis pedidos'}</a>
                  {esAdmin && <a href="#/admin" onClick={() => setMenuUsuarioAbierto(false)}>Panel de administración</a>}
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
      ) : vista === 'pedidos' ? (
        <MisPedidos sesion={sesion} esAdmin={esAdmin} formatoPrecio={formatoPrecio} onPedirLogin={() => setAcceso({})} />
      ) : (
      <>
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-texto">
            <span className="hero-etiqueta">Nueva colección</span>
            <h1>Viste con actitud,<br />a tu manera.</h1>
            <p>Ropa y accesorios juveniles para cada estilo. Envío gratis desde $300.000.</p>
            <div className="hero-botones">
              <button className="hero-btn" onClick={irAlCatalogo}>Ver catálogo</button>
              {categoriaDescuentos ? (
                <a className="hero-btn-sec" href="#catalogo" onClick={() => elegirCategoria(categoriaDescuentos.id)}>Descuentos</a>
              ) : (
                <a className="hero-btn-sec" href="#/info/envios-y-devoluciones">Envíos y cambios</a>
              )}
            </div>
          </div>
          {destacados.length > 0 && (
            <div className="hero-collage">
              {destacados.map(prod => (
                <a className="collage-card" key={prod.id} href={`#/producto/${prod.id}`}>
                  <img src={prod.imagen} alt={prod.nombre} />
                  <span className="collage-info">
                    <strong>{prod.nombre}</strong>
                    <small>
                      {formatoPrecio(prod.precio)}
                      {enDescuento(prod) && <s className="collage-antes">{formatoPrecio(prod.precio_anterior)}</s>}
                    </small>
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      {principales.length > 0 && (
        <section className="categorias-seccion" aria-label="Compra por categoría">
          <div className="categorias-circulos">
            {principales.map(cat => {
              const img = imagenDeCategoria(cat.id)
              return (
                <a
                  key={cat.id}
                  href="#catalogo"
                  className={`cat-circulo ${esDescuentos(cat) ? 'es-descuentos' : ''}`}
                  onClick={() => elegirCategoria(cat.id)}
                >
                  <span className="cat-foto">
                    {img ? <img src={img} alt="" /> : <span aria-hidden="true">{cat.nombre.charAt(0)}</span>}
                  </span>
                  {cat.nombre}
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
          {principales.map(cat => (
            <button key={cat.id} className={principalSeleccionada === cat.id ? 'activo' : ''} onClick={() => elegirCategoria(cat.id)}>
              {cat.nombre}
            </button>
          ))}
        </div>
        {principalSeleccionada && subcategoriasDe(principalSeleccionada).length > 0 && (
          <div className="subcategorias">
            <button
              className={categoriaSeleccionada === principalSeleccionada ? 'activo' : ''}
              onClick={() => elegirCategoria(principalSeleccionada)}
            >
              Todo {seleccionada.padre ? categorias.find(c => c.id === principalSeleccionada)?.nombre : seleccionada.nombre}
            </button>
            {subcategoriasDe(principalSeleccionada).map(sub => (
              <button key={sub.id} className={categoriaSeleccionada === sub.id ? 'activo' : ''} onClick={() => elegirCategoria(sub.id)}>
                {sub.nombre}
              </button>
            ))}
          </div>
        )}
        {textoBusqueda && (
          <p className="resultados">
            {productosFiltrados.length} resultado(s) para “{busqueda.trim()}”
          </p>
        )}
        <div className="productos">
          {productosFiltrados.map(prod => (
            <div className="producto" key={prod.id}>
              <a className="producto-imagen" href={`#/producto/${prod.id}`}>
                <EtiquetaDescuento producto={prod} />
                {prod.imagen
                  ? <img src={prod.imagen} alt={prod.nombre} />
                  : <span className="sin-imagen">{prod.nombre.charAt(0)}</span>
                }
              </a>
              <div className="producto-info">
                <h3><a className="producto-titulo" href={`#/producto/${prod.id}`}>{prod.nombre}</a></h3>
                <p className="descripcion">{prod.descripcion}</p>
                <div className="producto-footer">
                  <Precio producto={prod} formatoPrecio={formatoPrecio} />
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
                <p className="stock">
                  {tallasDe(prod).length > 0 ? tallasDe(prod).join(' · ') : `Stock disponible: ${prod.stock}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        {productosFiltrados.length === 0 && (
          <p className="vacio">
            {textoBusqueda
              ? 'No encontramos productos con esa búsqueda.'
              : esDescuentos(seleccionada)
                ? 'Por ahora no hay productos en descuento. ¡Vuelve pronto!'
                : 'No hay productos en esta categoría.'}
          </p>
        )}
      </section>

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

      <section
        className="banner-promo"
        style={imagenBanner ? { backgroundImage: `linear-gradient(90deg, rgba(31,38,34,0.92), rgba(31,38,34,0.55)), url("${imagenBanner}")` } : undefined}
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
              {principales.map(cat => (
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

      {datosAcceso && (
        <Login
          mensaje={datosAcceso.mensaje}
          onCerrar={cerrarLogin}
          onExito={iniciarSesion}
        />
      )}

      {checkoutAbierto && (
        <Checkout
          items={carrito}
          subtotal={totalCarrito}
          formatoPrecio={formatoPrecio}
          sesion={sesion}
          onCerrar={() => setCheckoutAbierto(false)}
          onFinalizar={finalizarCompra}
          onSesionVencida={sesionVencida}
        />
      )}
    </div>
  )
}

export default App