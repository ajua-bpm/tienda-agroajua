import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const Ctx = createContext(null);
const LS_KEY = 'ajua_cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  });

  // Sucursal for the current order (shared across all items)
  const [sucursalId,     setSucursalId]     = useState('');
  const [sucursalNombre, setSucursalNombre] = useState('');
  const [fechaEntrega,   setFechaEntrega]   = useState('');
  const [notas,          setNotas]          = useState('');

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }, [items]);

  // item: { id (presentacionId or productoId), nombre, descripcion, unidad, foto, sku }
  const add = useCallback((item, precio, qty = 1, sucId = null, sucNombre = '') => {
    if (sucId) { setSucursalId(sucId); setSucursalNombre(sucNombre); }
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, {
        id:          item.id,
        nombre:      item.nombre,
        descripcion: item.descripcion || '',
        unidad:      item.unidad || 'unidad',
        foto:        item.foto  || '',
        sku:         item.sku   || '',
        precio,
        qty,
      }];
    });
  }, []);

  const setQty = useCallback((id, qty) => {
    setItems(prev => qty <= 0
      ? prev.filter(i => i.id !== id)
      : prev.map(i => i.id === id ? { ...i, qty } : i)
    );
  }, []);

  const remove = useCallback(id => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setSucursalId(''); setSucursalNombre('');
    setFechaEntrega(''); setNotas('');
  }, []);

  const total   = items.reduce((s, i) => s + i.precio * i.qty, 0);
  const count   = items.reduce((s, i) => s + i.qty, 0);
  const isEmpty = items.length === 0;

  return (
    <Ctx.Provider value={{
      items, add, setQty, remove, clear,
      total, count, isEmpty,
      sucursalId, setSucursalId,
      sucursalNombre, setSucursalNombre,
      fechaEntrega, setFechaEntrega,
      notas, setNotas,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useCart = () => useContext(Ctx);
