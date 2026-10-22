# Tallas que se pueden marcar con casillas al crear un producto.
# En la base de datos se guardan como texto separado por comas, por ejemplo "S,M,L" o "38,39,40".
GRUPOS_TALLAS = [
    ('ropa', 'Ropa', ['XS', 'S', 'M', 'L', 'XL', 'XXL']),
    ('pantalon', 'Pantalón', ['6', '8', '10', '12', '14', '16', '28', '30', '32', '34', '36']),
    ('zapatos_mujer', 'Zapatos mujer', ['34', '35', '36', '37', '38', '39', '40', '41']),
    ('zapatos_hombre', 'Zapatos hombre', ['38', '39', '40', '41', '42', '43', '44', '45']),
]


def separar(texto):
    return [t.strip() for t in (texto or '').split(',') if t.strip()]


def grupo_para(tallas, preferido=None):
    """Elige en qué grupo de casillas mostrar unas tallas ya guardadas."""
    if not tallas:
        return None
    candidatos = [clave for clave, _, valores in GRUPOS_TALLAS if set(tallas) <= set(valores)]
    if preferido in candidatos:
        return preferido
    return candidatos[0] if candidatos else None
