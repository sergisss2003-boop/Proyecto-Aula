import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = 'http://127.0.0.1:8000/api'

function App() {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)

  useEffect(() => {
    axios.get(`${API_URL}/categorias/`)
      .then(response => setCategorias(response.data))
      .catch(error => console.error('Error cargando categorias:', error))

    axios.get(`${API_URL}/productos/`)
      .then(response => setProductos(response.data))
      .catch(error => console.error('Error cargando productos:', error))
  }, [])

  const productosFiltrados = categoriaSeleccionada
    ? productos.filter(p => p.categoria === categoriaSeleccionada)
    : productos

  const irAlCatalogo = () => {
    document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="tienda">
      <nav className="navbar">
        <span className="logo" onClick={() => setCategoriaSeleccionada(null)}>STUDIO SD</span>
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
          <a href="#" className="cart-icon">🛒</a>
        </div>
      </nav>

      <header className="hero">
        <h1>Nueva colección</h1>
        <p>Ropa y accesorios con actitud, para cada estilo.</p>
        <button className="hero-btn" onClick={irAlCatalogo}>Ver catálogo</button>
      </header>

      <section id="catalogo" className="catalogo-section">
        <div className="productos">
          {productosFiltrados.map(prod => (
            <div className="producto" key={prod.id}>
              <div className="producto-imagen">
                {prod.imagen
                  ? <img src={prod.imagen} alt={prod.nombre} />
                  : <span className="sin-imagen">{prod.nombre.charAt(0)}</span>
                }
              </div>
              <div className="producto-info">
                <h3>{prod.nombre}</h3>
                <p className="descripcion">{prod.descripcion}</p>
                <div className="producto-footer">
                  <span className="precio">${Number(prod.precio).toLocaleString('es-CO')}</span>
                  <button className="btn-agregar">Agregar</button>
                </div>
                <p className="stock">Stock disponible: {prod.stock}</p>
              </div>
            </div>
          ))}
        </div>

        {productosFiltrados.length === 0 && (
          <p className="vacio">No hay productos en esta categoría.</p>
        )}
      </section>

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
    </div>
  )
}

export default App