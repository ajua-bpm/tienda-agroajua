import { useState, useMemo, useEffect } from 'react';
import { useCollection } from '../hooks/useFirestore.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { db, doc, getDoc } from '../firebase.js';
import { buildPriceMap, getPromoParaProducto, aplicarPromo } from '../utils/precios.js';
import { fmtQ } from '../utils/format.js';
import { Link, useNavigate } from 'react-router-dom';

const G = '#1A3D28', ACC = '#4A9E6A';
const IVA_RATE = 0.12;

export default function Catalogo() {
  const { user, cliente } = useAuth();
  const { items, add, setQty, remove, total, count } = useCart();
  const toast    = useToast();
  const navigate = useNavigate();

  const { data: productos, loading } = useCollection('t_productos',   { orderField: 'nombre', limitN: 300 });
  const { data: promos }             = useCollection('t_promociones', { limitN: 50 });
  const [lista, setLista]   = useState(null);
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const lId = cliente?.listaId || 'general';
    if (!user) { setLista(null); return; }
    getDoc(doc(db, 't_listas', lId)).then(s => setLista(s.exists() ? { id: s.id, ...s.data() } : null));
  }, [user, cliente]);

  const priceMap = useMemo(() => buildPriceMap(lista), [lista]);

  const categorias = useMemo(() =>
    [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort(),
    [productos]
  );

  const visible = useMemo(() => {
    let list = productos.filter(p => p.activo !== false);
    if (filtro)   list = list.filter(p => p.categoria === filtro);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q));
    }
    return list;
  }, [productos, filtro, busqueda]);

  const grupos = useMemo(() => {
    const map = {};
    for (const p of visible) {
      const cat = p.categoria || 'Sin categoría';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const getBasePrice = p => {
    if (!user) return p.precioPublico || 0;
    return priceMap[p.id] || p.precioGeneral || p.precioPublico || 0;
  };

  const getFinalPrice = p => {
    const base  = getBasePrice(p);
    const promo = getPromoParaProducto(p, promos);
    return { base, promo, final: promo ? aplicarPromo(base, promo) : base };
  };

  const getItemQty = id => items.find(i => i.id === id)?.qty || 0;

  const setProductQty = (p, price, newQty) => {
    const qty = Math.max(0, parseInt(newQty) || 0);
    const current = items.find(i => i.id === p.id);
    if (qty === 0) { if (current) remove(p.id); return; }
    if (current) setQty(p.id, qty);
    else add(p, price, qty);
  };

  const neto = total / (1 + IVA_RATE);
  const iva  = total - neto;

  const irAOC = () => {
    if (count === 0) { toast('Seleccioná al menos un producto', 'warn'); return; }
    navigate('/checkout');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EF' }}>

      {/* ── Top bar ── */}
      <div style={{ background: G, position: 'sticky', top: 58, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 28px 0' }}>
          <div style={{ display: 'flex', gap: 8, maxWidth: 440, marginBottom: 10 }}>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto..."
              style={{ flex: 1, padding: '8px 14px', border: 'none', borderRadius: 4, fontSize: '.85rem', outline: 'none', background: 'rgba(255,255,255,.15)', color: '#F5F0E4' }}
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} style={{ padding: '8px 11px', background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 4, color: '#F5F0E4', cursor: 'pointer' }}>✕</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {['', ...categorias].map(cat => (
              <button key={cat} onClick={() => setFiltro(cat)} style={{
                padding: '7px 18px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '.78rem', whiteSpace: 'nowrap',
                background: filtro === cat ? '#FDFCF8' : 'transparent',
                color: filtro === cat ? G : 'rgba(245,240,228,.75)',
                borderRadius: filtro === cat ? '4px 4px 0 0' : 0,
                transition: 'all .1s',
              }}>
                {cat || 'Todos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!user && (
        <div style={{ background: '#1B4D32', color: 'rgba(245,240,228,.8)', padding: '7px 28px', fontSize: '.78rem', textAlign: 'center' }}>
          🔒 Precios privados para clientes registrados.{' '}
          <Link to="/login" style={{ color: '#8DC26F', fontWeight: 700, textDecoration: 'none' }}>Ingresar →</Link>
        </div>
      )}

      {/* ── Product table ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: count > 0 ? 110 : 40 }}>
        {loading ? (
          <div style={{ padding: '60px 28px', textAlign: 'center', color: '#6B8070' }}>Cargando catálogo...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '80px 28px', textAlign: 'center', color: '#6B8070' }}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>🔍</div>
            Sin resultados.
          </div>
        ) : (
          grupos.map(([cat, prods]) => (
            <div key={cat}>
              <div style={{ padding: '14px 28px 4px', fontSize: '.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6B8070' }}>
                {cat}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E8DCC8', background: '#FDFCF8' }}>
                    <th style={TH}>Producto</th>
                    <th style={{ ...TH, width: 90 }}>Unidad</th>
                    <th style={{ ...TH, width: 130, textAlign: 'right' }}>Precio unit.</th>
                    <th style={{ ...TH, width: 150, textAlign: 'center' }}>Cantidad</th>
                    <th style={{ ...TH, width: 120, textAlign: 'right', paddingRight: 28 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {prods.map(p => {
                    const { base, promo, final } = getFinalPrice(p);
                    const qty    = getItemQty(p.id);
                    const active = qty > 0;
                    const noItem = !final || p.enStock === false;

                    return (
                      <tr key={p.id} style={{
                        borderBottom: '1px solid #EDE9E1',
                        background: active ? '#EDF7F1' : '#FDFCF8',
                        transition: 'background .1s',
                      }}>
                        <td style={{ padding: '9px 8px 9px 28px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 4, background: '#E8DCC8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, overflow: 'hidden' }}>
                              {p.foto
                                ? <img src={p.foto} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : (p.emoji || '🌿')}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '.87rem', color: active ? G : '#333' }}>{p.nombre}</div>
                              {p.descripcion && (
                                <div style={{ fontSize: '.72rem', color: '#6B8070' }}>{p.descripcion}</div>
                              )}
                              {p.enStock === false && (
                                <span style={{ fontSize: '.68rem', color: '#C62828', fontWeight: 700 }}>✗ Sin stock</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '9px 8px', fontSize: '.82rem', color: '#6B8070' }}>{p.unidad || '—'}</td>

                        <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                          {!final ? (
                            <span style={{ fontSize: '.78rem', color: '#aaa' }}>Consultar</span>
                          ) : (
                            <div>
                              {promo && (
                                <div style={{ fontSize: '.68rem', color: '#aaa', textDecoration: 'line-through' }}>{fmtQ(base)}</div>
                              )}
                              <div style={{ fontWeight: 700, fontSize: '.88rem', color: promo ? '#E65100' : '#2D6645' }}>
                                {fmtQ(final)}
                              </div>
                              {promo && (
                                <span style={{ fontSize: '.62rem', background: '#E65100', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>
                                  {promo.tipo === '%' ? `-${promo.valor}%` : `-Q${promo.valor}`}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                          {noItem ? (
                            <span style={{ fontSize: '.75rem', color: '#ccc' }}>—</span>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: active ? '#fff' : '#F0EDE6', borderRadius: 6, padding: '3px 8px', border: `1.5px solid ${active ? ACC : '#D8D2C8'}` }}>
                              <button onClick={() => setProductQty(p, final, qty - 1)} style={{ ...QBtn, color: qty <= 1 ? '#ccc' : '#C62828' }}>−</button>
                              <input
                                type="number"
                                min="0"
                                value={qty || ''}
                                placeholder="0"
                                onChange={e => setProductQty(p, final, e.target.value)}
                                style={{ width: 34, textAlign: 'center', border: 'none', background: 'transparent', fontSize: '.92rem', fontWeight: 700, color: active ? G : '#888', outline: 'none', padding: 0 }}
                              />
                              <button onClick={() => setProductQty(p, final, qty + 1)} style={{ ...QBtn, color: ACC }}>+</button>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '9px 28px 9px 8px', textAlign: 'right' }}>
                          {active
                            ? <span style={{ fontWeight: 800, fontSize: '.9rem', color: G }}>{fmtQ(final * qty)}</span>
                            : <span style={{ color: '#ddd', fontSize: '.82rem' }}>—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* ── Sticky OC bar ── */}
      {count > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: G, color: '#F5F0E4',
          boxShadow: '0 -4px 24px rgba(0,0,0,.35)',
          padding: '12px 28px',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ flex: 1, display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '.8rem' }}>
                <strong style={{ color: '#8DC26F', fontSize: '1.05rem' }}>{count}</strong>
                <span style={{ opacity: .65, marginLeft: 4 }}>productos</span>
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: '.82rem' }}>
                <span style={{ opacity: .65 }}>Subtotal neto: <strong>{fmtQ(neto)}</strong></span>
                <span style={{ opacity: .65 }}>IVA 12%: <strong>{fmtQ(iva)}</strong></span>
                <span style={{ fontWeight: 900, fontSize: '1rem' }}>
                  Total: <strong style={{ color: '#8DC26F' }}>{fmtQ(total)}</strong>
                </span>
              </div>
            </div>
            <button onClick={irAOC} style={{
              padding: '11px 28px', background: ACC, color: '#fff',
              border: 'none', borderRadius: 4, fontWeight: 800, fontSize: '.9rem',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              boxShadow: '0 2px 8px rgba(74,158,106,.4)',
            }}>
              Generar Orden de Compra →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TH = {
  padding: '8px 8px 8px 28px',
  fontSize: '.69rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.06em',
  color: '#6B8070', textAlign: 'left',
};

const QBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '1rem', fontWeight: 900, padding: '0 2px',
  lineHeight: 1, display: 'flex', alignItems: 'center',
};
