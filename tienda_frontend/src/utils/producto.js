// Funciones de ayuda para los productos (se usan en varias páginas)

// "S, M, L" -> ['S', 'M', 'L']
export const tallasDe = (producto) =>
  (producto.talla || '').split(',').map(t => t.trim()).filter(Boolean)

// Porcentaje de descuento (0 si el producto no está en oferta)
export const descuentoDe = (producto) => {
  const antes = Number(producto.precio_anterior)
  const ahora = Number(producto.precio)
  if (!antes || antes <= ahora) return 0
  return Math.round((1 - ahora / antes) * 100)
}
