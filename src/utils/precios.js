/**
 * Price resolution logic
 *
 * Tiers: 'publico' → precioPublico field on product
 *        'general' → lista 'general' in t_listas
 *        'negociado' → lista ID assigned to client in t_clientes.listaId
 *
 * Falls back to precioPublico if no list price found.
 */

/**
 * Resolve price for a product given the active price list.
 * @param {Object} producto - product doc from t_productos
 * @param {Object|null} lista - price list doc from t_listas (or null for public)
 * @returns {number} resolved price
 */
export function resolverPrecio(producto, lista) {
  if (!lista) return producto.precioPublico || 0;

  const entry = (lista.items || []).find(i => i.productoId === producto.id);
  if (entry && entry.precio > 0) return entry.precio;

  // Fallback to general list price or public
  return producto.precioGeneral || producto.precioPublico || 0;
}

/**
 * Get active promo for a product (first match wins).
 * @param {Object} producto
 * @param {Array}  promos - all t_promociones docs
 * @returns {Object|null} promo doc or null
 */
export function getPromoParaProducto(producto, promos) {
  if (!promos?.length) return null;
  const hoy = new Date().toISOString().slice(0, 10);
  for (const p of promos) {
    if (!p.activa) continue;
    if (p.fechaInicio && hoy < p.fechaInicio) continue;
    if (p.fechaFin    && hoy > p.fechaFin)    continue;
    const aplica =
      p.aplicaA === 'todos' ||
      (p.aplicaA === 'categoria' && p.categoria === producto.categoria);
    if (aplica) return p;
  }
  return null;
}

/** Apply a promo discount to a base price. */
export function aplicarPromo(precio, promo) {
  if (!promo || !precio) return precio;
  if (promo.tipo === '%') return Math.max(0, precio * (1 - promo.valor / 100));
  if (promo.tipo === 'Q') return Math.max(0, precio - promo.valor);
  return precio;
}

/**
 * Check if order meets minimum purchase requirement for tier.
 * @param {number} total - order total in Q
 * @param {string} tier - 'publico'|'general'|'negociado'
 * @param {Object} config - t_config/tienda doc
 * @returns {{ ok: boolean, min: number }}
 */
export function checkMinimo(total, tier, config) {
  const min = config?.[`minCompra_${tier}`] ?? (tier === 'publico' ? 500 : 0);
  return { ok: total >= min, min };
}

/**
 * Build a price map { productoId → price } from a lista doc.
 * @param {Object|null} lista
 * @returns {Object}
 */
export function buildPriceMap(lista) {
  if (!lista) return {};
  return Object.fromEntries((lista.items || []).map(i => [i.productoId, i.precio]));
}
