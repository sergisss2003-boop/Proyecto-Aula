import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './api'

const formatoPrecio = (valor) => `$${Number(valor).toLocaleString('es-CO')}`

// "Mujer › Camisas" para las subcategorías, "Mujer" para las principales
const nombreCompleto = (cat, categorias) => {
  const padre = cat.padre ? categorias.find(c => c.id === cat.padre) : null
  return padre ? `${padre.nombre} › ${cat.nombre}` : cat.nombre
}

function mensajeError(error) {
  const data = error.response?.data
  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([campo, msgs]) => `${campo}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`)
      .join(' | ')
  }
  if (error.response?.status === 401) return 'Tu sesión expiró. Inicia sesión de nuevo.'
  if (error.response?.status === 403) return 'No tienes permisos de administrador.'
  if (error.response) return `El servidor respondió con error ${error.response.status}`
  return 'No se pudo conectar con el servidor. ¿Está encendido el backend?'
}

// Tallas que se pueden marcar con un clic (las mismas que en el admin de Django)
const GRUPOS_TALLAS = [
  { clave: 'ropa', nombre: 'Ropa', valores: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { clave: 'pantalon', nombre: 'Pantalón', valores: ['6', '8', '10', '12', '14', '16', '28', '30', '32', '34', '36'] },
  { clave: 'zapatos_mujer', nombre: 'Zapatos mujer', valores: ['34', '35', '36', '37', '38', '39', '40', '41'] },
  { clave: 'zapatos_hombre', nombre: 'Zapatos hombre', valores: ['38', '39', '40', '41', '42', '43', '44', '45'] },
]

const separarTallas = (texto) => (texto || '').split(',').map(t => t.trim()).filter(Boolean)

// Elige qué grupo mostrar al editar un producto que ya tiene tallas
function grupoInicial(tallas, esHombre) {
  if (tallas.length === 0) return 'ropa'
  const candidatos = GRUPOS_TALLAS.filter(g => tallas.every(t => g.valores.includes(t))).map(g => g.clave)
  if (esHombre && candidatos.includes('zapatos_hombre')) return 'zapatos_hombre'
  return candidatos[0] ?? 'ropa'
}

function SelectorTallas({ valor, onCambiar, esHombre }) {
  const tallas = separarTallas(valor)
  const [tipo, setTipo] = useState(() => grupoInicial(tallas, esHombre))
  const [otra, setOtra] = useState('')
  const grupo = GRUPOS_TALLAS.find(g => g.clave === tipo)

  const guardar = (lista) => onCambiar([...new Set(lista)].join(','))

  const alternar = (t) => {
    if (tallas.includes(t)) return guardar(tallas.filter(x => x !== t))
    // las tallas del grupo quedan en su orden natural (S antes que M, 38 antes que 39)
    const orden = (x) => { const i = grupo.valores.indexOf(x); return i === -1 ? -1 : i }
    guardar([...tallas, t].sort((a, b) => orden(a) - orden(b)))
  }

  const agregarOtra = () => {
    const nuevas = separarTallas(otra)
    if (nuevas.length) guardar([...tallas, ...nuevas])
    setOtra('')
  }

  return (
    <div className="selector-tallas">
      <span className="selector-titulo">Tallas (opcional)</span>
      <div className="tallas-tipos">
        {GRUPOS_TALLAS.map(g => (
          <button type="button" key={g.clave} className={tipo === g.clave ? 'activo' : ''} onClick={() => setTipo(g.clave)}>
            {g.nombre}
          </button>
        ))}
      </div>
      <div className="tallas-opciones">
        {grupo.valores.map(t => (
          <button type="button" key={t} className={tallas.includes(t) ? 'marcada' : ''} onClick={() => alternar(t)}>
            {t}
          </button>
        ))}
        <button type="button" className="tallas-todas" onClick={() => guardar([...tallas, ...grupo.valores])}>Todas</button>
      </div>
      <div className="tallas-otra">
        <input
          value={otra}
          onChange={(e) => setOtra(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarOtra() } }}
          placeholder="Otra talla (ej: Única)"
        />
        <button type="button" className="btn-secundario" onClick={agregarOtra}>Agregar</button>
      </div>
      <p className="tallas-elegidas">
        {tallas.length === 0 ? 'Sin tallas: en la tienda saldrá el botón “Agregar” directo.' : <>Seleccionadas:{' '}
          {tallas.map(t => (
            <span key={t} className="talla-chip">
              {t}
              <button type="button" onClick={() => guardar(tallas.filter(x => x !== t))} aria-label={`Quitar talla ${t}`}>✕</button>
            </span>
          ))}
          <button type="button" className="tallas-limpiar" onClick={() => onCambiar('')}>Quitar todas</button>
        </>}
      </p>
    </div>
  )
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

function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{titulo}</h3>
          <button className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormProducto({ api, producto, categorias, onGuardado, onCancelar, onError }) {
  const [datos, setDatos] = useState({
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    precio: producto?.precio ? String(Number(producto.precio)) : '',
    precio_anterior: producto?.precio_anterior ? String(Number(producto.precio_anterior)) : '',
    stock: producto?.stock ?? 0,
    talla: producto?.talla ?? '',
    color: producto?.color ?? '',
    categoria: producto?.categoria ?? categorias[0]?.id ?? '',
    estado: producto?.estado ?? 'activo',
  })
  const [archivo, setArchivo] = useState(null)
  const [vista, setVista] = useState(producto?.imagen ?? null)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const cambiar = (e) => {
    setDatos(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setErrores(prev => ({ ...prev, [e.target.name]: undefined }))
  }

  const elegirImagen = (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setErrores(prev => ({ ...prev, imagen: 'El archivo debe ser una imagen' }))
      return
    }
    setErrores(prev => ({ ...prev, imagen: undefined }))
    setArchivo(f)
    setVista(URL.createObjectURL(f))
  }

  const validar = () => {
    const err = {}
    if (datos.nombre.trim().length < 2) err.nombre = 'Escribe el nombre del producto'
    const precio = Number(datos.precio)
    if (datos.precio === '' || isNaN(precio) || precio < 0 || precio > 99999999.99) err.precio = 'Precio no válido'
    if (datos.precio_anterior !== '') {
      const anterior = Number(datos.precio_anterior)
      if (isNaN(anterior) || anterior > 99999999.99) err.precio_anterior = 'Precio no válido'
      else if (anterior <= precio) err.precio_anterior = 'Debe ser mayor que el precio actual'
    }
    const stock = Number(datos.stock)
    if (datos.stock === '' || !Number.isInteger(stock) || stock < 0) err.stock = 'Debe ser un número entero, 0 o más'
    if (!datos.categoria) err.categoria = 'Selecciona una categoría'
    setErrores(err)
    return Object.keys(err).length === 0
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!validar()) return
    const fd = new FormData()
    const tallas = datos.talla.split(',').map(t => t.trim()).filter(Boolean).join(',')
    Object.entries({ ...datos, talla: tallas }).forEach(([clave, valor]) => fd.append(clave, valor))
    if (archivo) fd.append('imagen', archivo)
    setGuardando(true)
    try {
      if (producto) await api.patch(`/productos/${producto.id}/`, fd)
      else await api.post('/productos/', fd)
      onGuardado(producto ? 'Producto actualizado' : 'Producto creado')
    } catch (error) {
      onError(mensajeError(error))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} noValidate>
      <Campo label="Nombre" error={errores.nombre}>
        <input name="nombre" value={datos.nombre} onChange={cambiar} />
      </Campo>
      <Campo label="Descripción">
        <textarea name="descripcion" rows="3" value={datos.descripcion} onChange={cambiar} />
      </Campo>
      <div className="campos-grid">
        <Campo label="Precio (COP)" error={errores.precio}>
          <input name="precio" type="number" min="0" step="0.01" value={datos.precio} onChange={cambiar} />
        </Campo>
        <Campo label="Precio antes (opcional, para ponerlo en descuento)" error={errores.precio_anterior}>
          <input name="precio_anterior" type="number" min="0" step="0.01" value={datos.precio_anterior} onChange={cambiar} placeholder="Vacío = sin descuento" />
        </Campo>
        <Campo label="Stock" error={errores.stock}>
          <input name="stock" type="number" min="0" step="1" value={datos.stock} onChange={cambiar} />
        </Campo>
        <Campo label="Color (opcional)">
          <input name="color" value={datos.color} onChange={cambiar} />
        </Campo>
        <Campo label="Categoría" error={errores.categoria}>
          <select name="categoria" value={datos.categoria} onChange={cambiar}>
            {categorias.map(c => <option key={c.id} value={c.id}>{nombreCompleto(c, categorias)}</option>)}
          </select>
        </Campo>
        <Campo label="Estado">
          <select name="estado" value={datos.estado} onChange={cambiar}>
            <option value="activo">Activo (visible en la tienda)</option>
            <option value="inactivo">Inactivo (oculto)</option>
          </select>
        </Campo>
      </div>

      <SelectorTallas
        valor={datos.talla}
        onCambiar={(talla) => setDatos(prev => ({ ...prev, talla }))}
        esHombre={/hombre/i.test(nombreCompleto(categorias.find(c => c.id === Number(datos.categoria)) ?? { nombre: '' }, categorias))}
      />

      <Campo label="Imagen del producto" error={errores.imagen}>
        <input type="file" accept="image/*" onChange={elegirImagen} />
      </Campo>
      {vista && <img className="vista-previa" src={vista} alt="Vista previa" />}

      <div className="modal-botones">
        <button type="button" className="btn-secundario" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button type="submit" className="btn-principal" disabled={guardando}>
          {guardando ? 'Guardando...' : producto ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </form>
  )
}

function FormCategoria({ api, categoria, categorias, onGuardado, onCancelar, onError }) {
  const [datos, setDatos] = useState({
    nombre: categoria?.nombre ?? '',
    descripcion: categoria?.descripcion ?? '',
    padre: categoria?.padre ?? '',
    orden: categoria?.orden ?? 0,
  })
  // Solo una categoría principal (y que no sea ella misma) puede ser "padre"
  const posiblesPadres = categorias.filter(c => !c.padre && c.id !== categoria?.id)
  const tieneSubcategorias = categoria && categorias.some(c => c.padre === categoria.id)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (datos.nombre.trim().length < 2) {
      setError('Escribe el nombre de la categoría')
      return
    }
    setGuardando(true)
    try {
      const envio = { ...datos, padre: datos.padre === '' ? null : Number(datos.padre), orden: Number(datos.orden) || 0 }
      if (categoria) await api.patch(`/categorias/${categoria.id}/`, envio)
      else await api.post('/categorias/', envio)
      onGuardado(categoria ? 'Categoría actualizada' : 'Categoría creada')
    } catch (err) {
      onError(mensajeError(err))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} noValidate>
      <Campo label="Nombre" error={error}>
        <input value={datos.nombre} onChange={(e) => { setDatos({ ...datos, nombre: e.target.value }); setError('') }} />
      </Campo>
      <Campo label="Pertenece a">
        <select
          value={datos.padre}
          onChange={(e) => setDatos({ ...datos, padre: e.target.value })}
          disabled={tieneSubcategorias}
        >
          <option value="">— Ninguna (categoría principal del menú) —</option>
          {posiblesPadres.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </Campo>
      <Campo label="Orden en el menú (los números más bajos van primero)">
        <input type="number" min="0" value={datos.orden} onChange={(e) => setDatos({ ...datos, orden: e.target.value })} />
      </Campo>
      <Campo label="Descripción (opcional)">
        <textarea rows="3" value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
      </Campo>
      <div className="modal-botones">
        <button type="button" className="btn-secundario" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button type="submit" className="btn-principal" disabled={guardando}>
          {guardando ? 'Guardando...' : categoria ? 'Guardar cambios' : 'Crear categoría'}
        </button>
      </div>
    </form>
  )
}

// Pide categorías y productos al mismo tiempo
const pedirDatos = (api) =>
  Promise.all([api.get('/categorias/'), api.get('/productos/')])
    .then(([cats, prods]) => ({ categorias: cats.data, productos: prods.data }))

function Admin({ usuario, onSalir }) {
  const salirRef = useRef(onSalir)
  useEffect(() => { salirRef.current = onSalir })

  // La sesión viaja en la cookie HttpOnly (la envía el navegador); si el servidor responde 401
  // (el token venció a los 15 minutos o no es válido), se cierra la sesión
  useEffect(() => {
    const id = api.interceptors.response.use(
      (respuesta) => respuesta,
      (error) => {
        if (error.response?.status === 401) salirRef.current()
        return Promise.reject(error)
      }
    )
    return () => api.interceptors.response.eject(id)
  }, [])

  const [pestana, setPestana] = useState('productos')
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [aviso, setAviso] = useState(null)
  const [modal, setModal] = useState(null)       // { tipo: 'producto' | 'categoria', item }
  const [confirmar, setConfirmar] = useState(null) // { tipo, item }
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(() =>
    pedirDatos(api)
      .then(datos => {
        setCategorias(datos.categorias)
        setProductos(datos.productos)
      })
      .catch(error => setAviso({ tipo: 'error', texto: mensajeError(error) }))
      .finally(() => setCargando(false)),
  [])

  // Carga inicial del panel
  useEffect(() => {
    pedirDatos(api)
      .then(datos => {
        setCategorias(datos.categorias)
        setProductos(datos.productos)
      })
      .catch(error => setAviso({ tipo: 'error', texto: mensajeError(error) }))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  const nombreCategoria = (id) => {
    const cat = categorias.find(c => c.id === id)
    return cat ? nombreCompleto(cat, categorias) : '—'
  }
  const cuentaProductos = (id) => productos.filter(p => p.categoria === id).length

  const guardado = (texto) => {
    setModal(null)
    setAviso({ tipo: 'ok', texto })
    cargar()
  }

  const eliminar = async () => {
    const { tipo, item } = confirmar
    setEliminando(true)
    try {
      await api.delete(`/${tipo === 'producto' ? 'productos' : 'categorias'}/${item.id}/`)
      setAviso({ tipo: 'ok', texto: tipo === 'producto' ? 'Producto eliminado' : 'Categoría eliminada' })
      setConfirmar(null)
      cargar()
    } catch (error) {
      setAviso({ tipo: 'error', texto: mensajeError(error) })
      setConfirmar(null)
    } finally {
      setEliminando(false)
    }
  }

  const productosVisibles = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const abrirNuevoProducto = () => {
    if (categorias.length === 0) {
      setAviso({ tipo: 'error', texto: 'Primero crea al menos una categoría.' })
      setPestana('categorias')
      return
    }
    setModal({ tipo: 'producto', item: null })
  }

  return (
    <div className="admin">
      <header className="admin-top">
        <span className="logo">STUDIO SD <small>· Panel de administración</small></span>
        <div className="admin-sesion">
          <span>Hola, <strong>{usuario}</strong></span>
          <a href="#" className="admin-volver">← Volver a la tienda</a>
          <button className="admin-salir" onClick={onSalir}>Cerrar sesión</button>
        </div>
      </header>

      <main className="admin-contenido">
        <div className="admin-tabs">
          <button className={pestana === 'productos' ? 'activo' : ''} onClick={() => setPestana('productos')}>
            Productos ({productos.length})
          </button>
          <button className={pestana === 'categorias' ? 'activo' : ''} onClick={() => setPestana('categorias')}>
            Categorías ({categorias.length})
          </button>
        </div>

        {aviso && <div className={`aviso aviso-${aviso.tipo}`}>{aviso.texto}</div>}

        {cargando ? (
          <p className="vacio">Cargando...</p>
        ) : pestana === 'productos' ? (
          <section>
            <div className="admin-barra">
              <input
                className="admin-buscar"
                placeholder="Buscar producto por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <button className="btn-principal" onClick={abrirNuevoProducto}>+ Nuevo producto</button>
            </div>
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr><th>Imagen</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {productosVisibles.map(p => (
                    <tr key={p.id}>
                      <td>{p.imagen ? <img className="mini" src={p.imagen} alt={p.nombre} /> : <span className="mini mini-vacia">{p.nombre.charAt(0)}</span>}</td>
                      <td><strong>{p.nombre}</strong></td>
                      <td>{nombreCategoria(p.categoria)}</td>
                      <td>
                        {formatoPrecio(p.precio)}
                        {Number(p.precio_anterior) > Number(p.precio) && (
                          <><br /><s className="precio-antes">{formatoPrecio(p.precio_anterior)}</s></>
                        )}
                      </td>
                      <td>{p.stock}</td>
                      <td><span className={`estado estado-${p.estado}`}>{p.estado}</span></td>
                      <td className="acciones">
                        <button className="btn-tabla" onClick={() => setModal({ tipo: 'producto', item: p })}>Editar</button>
                        <button className="btn-tabla peligro" onClick={() => setConfirmar({ tipo: 'producto', item: p })}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productosVisibles.length === 0 && <p className="vacio">No hay productos para mostrar.</p>}
            </div>
          </section>
        ) : (
          <section>
            <div className="admin-barra">
              <span />
              <button className="btn-principal" onClick={() => setModal({ tipo: 'categoria', item: null })}>+ Nueva categoría</button>
            </div>
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr><th>Nombre</th><th>Pertenece a</th><th>Orden</th><th>Productos</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {categorias.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.nombre}</strong></td>
                      <td>{c.padre ? nombreCategoria(c.padre) : 'Principal'}</td>
                      <td>{c.orden}</td>
                      <td>{cuentaProductos(c.id)}</td>
                      <td className="acciones">
                        <button className="btn-tabla" onClick={() => setModal({ tipo: 'categoria', item: c })}>Editar</button>
                        <button className="btn-tabla peligro" onClick={() => setConfirmar({ tipo: 'categoria', item: c })}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {categorias.length === 0 && <p className="vacio">Aún no hay categorías.</p>}
            </div>
          </section>
        )}
      </main>

      {modal && (
        <Modal
          titulo={`${modal.item ? 'Editar' : 'Nuevo'} ${modal.tipo === 'producto' ? 'producto' : 'categoría'}`}
          onCerrar={() => setModal(null)}
        >
          {modal.tipo === 'producto' ? (
            <FormProducto
              api={api}
              producto={modal.item}
              categorias={categorias}
              onGuardado={guardado}
              onCancelar={() => setModal(null)}
              onError={(texto) => setAviso({ tipo: 'error', texto })}
            />
          ) : (
            <FormCategoria
              api={api}
              categoria={modal.item}
              categorias={categorias}
              onGuardado={guardado}
              onCancelar={() => setModal(null)}
              onError={(texto) => setAviso({ tipo: 'error', texto })}
            />
          )}
        </Modal>
      )}

      {confirmar && (
        <Modal titulo="Confirmar eliminación" onCerrar={() => setConfirmar(null)}>
          <p>
            ¿Seguro que quieres eliminar <strong>{confirmar.item.nombre}</strong>? Esta acción no se puede deshacer.
          </p>
          {confirmar.tipo === 'categoria' && cuentaProductos(confirmar.item.id) > 0 && (
            <p className="aviso aviso-error">
              Esta categoría tiene {cuentaProductos(confirmar.item.id)} producto(s). Al eliminarla, también se eliminarán esos productos.
            </p>
          )}
          <div className="modal-botones">
            <button className="btn-secundario" onClick={() => setConfirmar(null)} disabled={eliminando}>Cancelar</button>
            <button className="btn-peligro" onClick={eliminar} disabled={eliminando}>
              {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Admin