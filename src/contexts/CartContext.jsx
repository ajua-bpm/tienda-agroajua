import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const Ctx = createContext(null);
const LS_KEY = 'ajua_cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((producto, precio, qty = 1) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === producto.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, {
        id:     producto.id,
        nombre: producto.nombre,
        unidad: producto.unidad || 'unidad',
        foto:   producto.foto || '',
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

  const clear = useCallback(() => setItems([]), []);

  const total    = items.reduce((s, i) => s + i.precio * i.qty, 0);
  const count    = items.reduce((s, i) => s + i.qty, 0);
  const isEmpty  = items.length === 0;

  return (
    <Ctx.Provider value={{ items, add, setQty, remove, clear, total, count, isEmpty }}>
      {children}
    </Ctx.Provider>
  );
}

export const useCart = () => useContext(Ctx);
