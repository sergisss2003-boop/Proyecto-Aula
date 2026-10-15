import { useState } from 'react'

export const SECCIONES_INFO = [
  { id: 'preguntas-frecuentes', titulo: 'Preguntas frecuentes' },
  { id: 'envios-y-devoluciones', titulo: 'Envíos y devoluciones' },
  { id: 'privacidad', titulo: 'Política de privacidad' },
  { id: 'contacto', titulo: 'Contáctanos' },
]

const PREGUNTAS = [
  {
    p: '¿Cómo hago una compra?',
    r: 'Entra a la página del producto, elige tu talla y pulsa "Agregar al carrito". Cuando tengas todo, abre el carrito, pulsa "Finalizar compra" y completa tus datos de envío y pago.',
  },
  {
    p: '¿Cuánto tarda y cuánto cuesta el envío?',
    r: 'El envío estándar cuesta $12.000 y llega en 3 a 5 días hábiles. El envío express cuesta $25.000 y llega en 1 a 2 días hábiles. Las compras desde $300.000 tienen envío estándar gratis.',
  },
  {
    p: '¿Qué medios de pago aceptan?',
    r: 'Puedes pagar con tarjeta de crédito o débito (Visa, Mastercard, American Express). Tus datos se validan en el formulario de pago de la tienda.',
  },
  {
    p: '¿Cómo sé cuál es mi talla?',
    r: 'En cada producto verás las tallas disponibles. Si estás entre dos tallas, te recomendamos la mayor para un calce más cómodo; las prendas oversize ya tienen un corte amplio.',
  },
  {
    p: '¿Puedo cambiar o devolver mi pedido?',
    r: 'Sí. Tienes 30 días desde que recibes tu pedido para solicitar un cambio o devolución, siempre que la prenda esté sin uso y con sus etiquetas. Los detalles están en la sección Envíos y devoluciones.',
  },
  {
    p: '¿Cómo puedo hacer seguimiento a mi pedido?',
    r: 'Al finalizar la compra recibes un número de pedido (con formato SD-…). Con ese número puedes escribirnos desde la sección Contáctanos y te informamos el estado de tu envío.',
  },
  {
    p: '¿Qué pasa si un producto aparece agotado?',
    r: 'El stock se actualiza en tiempo real. Si un producto está agotado, escríbenos y te avisamos cuando vuelva a estar disponible.',
  },
]

function Preguntas() {
  const [abierta, setAbierta] = useState(0)
  return (
    <div className="faq">
      {PREGUNTAS.map((item, i) => (
        <div className={`faq-item ${abierta === i ? 'abierta' : ''}`} key={item.p}>
          <button
            className="faq-pregunta"
            onClick={() => setAbierta(abierta === i ? null : i)}
            aria-expanded={abierta === i}
          >
            <span>{item.p}</span>
            <span className="faq-mas" aria-hidden="true">{abierta === i ? '−' : '+'}</span>
          </button>
          {abierta === i && <p className="faq-respuesta">{item.r}</p>}
        </div>
      ))}
    </div>
  )
}

function Envios() {
  return (
    <div className="info-texto">
      <h3>Envíos</h3>
      <table className="info-tabla">
        <thead>
          <tr><th>Tipo</th><th>Tiempo</th><th>Costo</th></tr>
        </thead>
        <tbody>
          <tr><td>Estándar</td><td>3 a 5 días hábiles</td><td>$12.000 (gratis desde $300.000)</td></tr>
          <tr><td>Express</td><td>1 a 2 días hábiles</td><td>$25.000</td></tr>
        </tbody>
      </table>
      <p>Hacemos envíos a todo el país. Los pedidos se despachan de lunes a viernes; los realizados después de las 6:00 pm se procesan el siguiente día hábil.</p>
      <h3>Cambios y devoluciones</h3>
      <ul>
        <li>Tienes 30 días desde la entrega para solicitar un cambio o devolución.</li>
        <li>La prenda debe estar sin uso, sin lavar y con sus etiquetas originales.</li>
        <li>Para solicitarlo, escríbenos desde la sección Contáctanos con tu número de pedido.</li>
        <li>Si la prenda llegó con defecto, asumimos el costo del envío de regreso.</li>
        <li>El reembolso se hace al mismo medio de pago, una vez revisamos la prenda.</li>
      </ul>
    </div>
  )
}

function Privacidad() {
  return (
    <div className="info-texto">
      <p>En Studio SD respetamos tu privacidad. Esta política explica qué datos usamos y para qué.</p>
      <h3>Qué datos recogemos</h3>
      <p>Solo los necesarios para completar tu compra: nombre, dirección de envío, correo y teléfono de contacto.</p>
      <h3>Para qué los usamos</h3>
      <ul>
        <li>Procesar y entregar tus pedidos.</li>
        <li>Responder tus solicitudes de soporte.</li>
        <li>Enviarte novedades y promociones, solo si te suscribes al boletín.</li>
      </ul>
      <h3>Tus pagos</h3>
      <p>Los datos de tu tarjeta se usan únicamente para validar el pago y no se almacenan en nuestros servidores.</p>
      <h3>Tus derechos</h3>
      <p>Puedes pedirnos en cualquier momento que consultemos, corrijamos o eliminemos tus datos escribiendo a contacto@studiosd.co.</p>
    </div>
  )
}

function Contacto() {
  const [form, setForm] = useState({ nombre: '', correo: '', mensaje: '' })
  const [errores, setErrores] = useState({})
  const [enviado, setEnviado] = useState(false)

  const cambiar = (campo) => (e) => {
    setForm({ ...form, [campo]: e.target.value })
    setErrores({ ...errores, [campo]: '' })
  }

  const enviar = (e) => {
    e.preventDefault()
    const nuevos = {}
    if (form.nombre.trim().length < 2) nuevos.nombre = 'Escribe tu nombre.'
    if (!/^\S+@\S+\.\S+$/.test(form.correo.trim())) nuevos.correo = 'Escribe un correo válido.'
    if (form.mensaje.trim().length < 10) nuevos.mensaje = 'Cuéntanos un poco más (mínimo 10 caracteres).'
    setErrores(nuevos)
    if (Object.keys(nuevos).length === 0) setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="contacto-ok">
        <h3>¡Gracias, {form.nombre.trim()}!</h3>
        <p>Recibimos tu mensaje. Te responderemos a {form.correo.trim()} en un máximo de 1 día hábil.</p>
        <button className="btn-info" onClick={() => { setForm({ nombre: '', correo: '', mensaje: '' }); setEnviado(false) }}>
          Enviar otro mensaje
        </button>
      </div>
    )
  }

  return (
    <div className="contacto-grid">
      <form className="contacto-form" onSubmit={enviar} noValidate>
        <label>
          Nombre
          <input value={form.nombre} onChange={cambiar('nombre')} placeholder="Tu nombre" />
          {errores.nombre && <span className="campo-error">{errores.nombre}</span>}
        </label>
        <label>
          Correo electrónico
          <input type="email" value={form.correo} onChange={cambiar('correo')} placeholder="tucorreo@ejemplo.com" />
          {errores.correo && <span className="campo-error">{errores.correo}</span>}
        </label>
        <label>
          Mensaje
          <textarea rows="5" value={form.mensaje} onChange={cambiar('mensaje')} placeholder="¿En qué podemos ayudarte? Si es sobre un pedido, incluye su número (SD-…)" />
          {errores.mensaje && <span className="campo-error">{errores.mensaje}</span>}
        </label>
        <button className="btn-info" type="submit">Enviar mensaje</button>
      </form>
      <aside className="contacto-datos">
        <h3>Atención al cliente</h3>
        <p><strong>Horario</strong><br />Lunes a viernes, 8:00 am - 6:00 pm</p>
        <p><strong>Correo</strong><br />contacto@studiosd.co</p>
        <p><strong>Tiempo de respuesta</strong><br />Máximo 1 día hábil</p>
      </aside>
    </div>
  )
}

function Info({ seccion }) {
  const actual = SECCIONES_INFO.find(s => s.id === seccion) || SECCIONES_INFO[0]
  return (
    <section className="info-page">
      <header className="info-hero">
        <p className="info-etiqueta">Servicio al cliente</p>
        <h1>{actual.titulo}</h1>
      </header>
      <div className="info-cuerpo">
        <nav className="info-menu" aria-label="Servicio al cliente">
          {SECCIONES_INFO.map(s => (
            <a key={s.id} href={`#/info/${s.id}`} className={s.id === actual.id ? 'activo' : ''}>
              {s.titulo}
            </a>
          ))}
        </nav>
        <div className="info-contenido" key={actual.id}>
          {actual.id === 'preguntas-frecuentes' && <Preguntas />}
          {actual.id === 'envios-y-devoluciones' && <Envios />}
          {actual.id === 'privacidad' && <Privacidad />}
          {actual.id === 'contacto' && <Contacto />}
        </div>
      </div>
    </section>
  )
}

export default Info
