import { useState, useCallback, useRef } from 'react';
import { db, collection, getDocs, query, where } from '../firebase.js';

// Module-level in-memory cache shared across hook instances
let _cache = null;
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Load pricing collections with in-memory cache.
 * Uses the same Firestore collections as the BPM pricing module:
 *   preciosCliente (where activo==true)
 *   preciosVolumen (where activo==true)
 */
async function loadPricingData() {
  const now = Date.now();
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.data;

  const [preciosSnap, volumenSnap] = await Promise.all([
    getDocs(query(collection(db, 'preciosCliente'), where('activo', '==', true))),
    getDocs(query(collection(db, 'preciosVolumen'), where('activo', '==', true))),
  ]);

  const data = {
    precios: preciosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    volumen: volumenSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
  _cache = { data, ts: now };
  return data;
}

/**
 * Resolve the best price for a given presentacion + client + quantity.
 *
 * Priority:
 * 1. Volume price specific to this client + quantity (highest tier that fits)
 * 2. Client-specific price (vigencia date check)
 * 3. General volume price (no clienteId) + quantity
 * 4. null → caller uses precioBase from ipresentaciones
 *
 * @param {string} presentacionId
 * @param {string|null} clienteId
 * @param {number} cantidad
 * @param {{ precios: object[], volumen: object[] }} data
 * @returns {{ precio: number, tipo: string } | null}
 */
function resolvePrecio(presentacionId, clienteId, cantidad, { precios = [], volumen = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const qty = Number(cantidad) || 0;

  // 1. Volume price: specific client + quantity
  if (clienteId) {
    const clientVolTiers = volumen
      .filter(v =>
        v.presentacionId === presentacionId &&
        v.clienteId === clienteId &&
        Number(v.cantidadMinima) <= qty
      )
      .sort((a, b) => Number(b.cantidadMinima) - Number(a.cantidadMinima));
    if (clientVolTiers.length > 0) {
      return { precio: Number(clientVolTiers[0].precio), tipo: 'volumen-cliente' };
    }
  }

  // 2. Client-specific price with vigencia check
  if (clienteId) {
    const clientPrice = precios.find(p => {
      if (p.presentacionId !== presentacionId || p.clienteId !== clienteId) return false;
      if (p.vigenteDesde && today < p.vigenteDesde) return false;
      if (p.vigenteHasta && today > p.vigenteHasta) return false;
      return true;
    });
    if (clientPrice) {
      return { precio: Number(clientPrice.precio), tipo: 'cliente' };
    }
  }

  // 3. General volume price (no clienteId) + quantity
  const generalVolTiers = volumen
    .filter(v =>
      v.presentacionId === presentacionId &&
      !v.clienteId &&
      Number(v.cantidadMinima) <= qty
    )
    .sort((a, b) => Number(b.cantidadMinima) - Number(a.cantidadMinima));
  if (generalVolTiers.length > 0) {
    return { precio: Number(generalVolTiers[0].precio), tipo: 'volumen-general' };
  }

  return null;
}

/**
 * usePrecioTienda(clienteId)
 *
 * Tienda-specific pricing hook. Loads pricing data once (60s cache) and
 * returns a `getPrice(presentacionId, cantidad)` function.
 *
 * Usage in catalog:
 *   const { getPrice, loading } = usePrecioTienda(clienteId);
 *   // For products with a presentacionId field:
 *   const result = getPrice(product.presentacionId, qty);
 *   const finalPrice = result ? result.precio : product.precio; // fallback to existing field
 *
 * @param {string|null} clienteId - authenticated client's Firestore ID (or null for anonymous)
 * @returns {{ getPrice: Function, loading: boolean, invalidateCache: Function }}
 */
export function usePrecioTienda(clienteId) {
  const [loading, setLoading] = useState(false);
  const dataRef = useRef(null);

  const ensureData = useCallback(async () => {
    if (dataRef.current) return dataRef.current;
    setLoading(true);
    try {
      const d = await loadPricingData();
      dataRef.current = d;
      return d;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get the resolved price for a presentacion + optional quantity.
   * This is an async function — call it when rendering or in an effect.
   *
   * @param {string} presentacionId
   * @param {number} [cantidad=1]
   * @returns {Promise<{ precio: number, tipo: string } | null>}
   */
  const getPrice = useCallback(async (presentacionId, cantidad = 1) => {
    const data = await ensureData();
    return resolvePrecio(presentacionId, clienteId || null, cantidad, data);
  }, [ensureData, clienteId]);

  const invalidateCache = useCallback(() => {
    _cache = null;
    dataRef.current = null;
  }, []);

  return { getPrice, loading, invalidateCache };
}

/**
 * Also export the pure resolver for use outside of React components.
 */
export { resolvePrecio };
