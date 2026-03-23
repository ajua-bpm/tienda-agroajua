import { useState, useMemo, useEffect } from 'react';
import { useCollection } from '../hooks/useFirestore.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { db, doc, getDoc } from '../firebase.js';
import { resolverPrecio, buildPriceMap, getPromoParaProducto, aplicarPromo } from '../utils/precios.js';
import { fmtQ } from '../utils/format.js';
import { Link } from 'react-router-dom';

const G = '#1A3D28', ACC = '#4A9E6A';

export default function Catalogo() {
  const { user, cliente, tier, listaId } = useAuth();
  const { add, count } = useCart();
  const toast = useToast();

  const { data: productos, loading } = useCollection('t_productos',   { orderField: 'nombre', limitN: 300 });
  const { data: promos }             = useCollection('t_promociones', { limitN: 50 });
  const [lista, setLista]   = useState(null);
  const [config, setConfig] = useState({});
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Load price list for this customer
  useEffect(() => {
    const lId = cliente?.listaId || 'general';
    if (!user) { setLista(null); return; }
    getDoc(doc(db, 't_listas', lId)).then(s => setLista(s.exists() ? { id: s.id, ...s.data() } : null));
  }, [user, cliente]);

  // Load store config (min purchases, etc.)
  useEffect(() => {
    getDoc(doc(db, 't_config', 'tienda')).then(s => setConfig(s.exists() ? s.data() : {}));
  }, []);

  const priceMap = useMemo(() => buildPriceMap(lista), [lista]);

  // Categories derived from products
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

  const getBasePrice = p => {
    if (!user) return p.precioPublico || 0;
    return priceMap[p.id] || p.precioGeneral || p.precioPublico || 0;
  };

  const getPrecioConPromo = p => {
    const base  = getBasePrice(p);
    const promo = getPromoParaProducto(p, promos);
    return { base, promo, final: promo ? aplicarPromo(base, promo) : base };
  };

  const addItem = p => {
    const { final } = getPrecioConPromo(p);
    if (!final) { toast('Precio no disponible — contacte a AJÚA', 'warn'); return; }
    add(p, final);
    toast(`✓ ${p.nombre} agregado al carrito`);
  };

  return (
    <div>
      {/* Hero */}
      <div style={{ background: G, color: '#F5F0E4', padding: '44px 28px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.6rem)', fontWeight: 900, marginBottom: 10, lineHeight: 1.1 }}>
          Vegetales frescos,<br />directo al negocio.
        </h1>
        <p style={{ fontSize: '.95rem', opacity: .75, maxWidth: 480, margin: '0 auto 22px' }}>
          Catálogo actualizado de Agroindustria AJÚA. Precios públicos y listas privadas para clientes registrados.
        </p>
        <div style={{ display: 'flex', gap: 8, maxWidth: 460, margin: '0 auto' }}>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            style={{ flex: 1, padding: '11px 16px', border: 'none', borderRadius: 4, fontSize: '.88rem', outline: 'none', background: '#FDFCF8' }}
          />
          <button style={{ padding: '11px 18px', background: ACC, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>🔍</button>
        </div>
        {!user && (
          <div style={{ marginTop: 14, fontSize: '.8rem', opacity: .8 }}>
            🔒 Precios privados disponibles para clientes registrados.{' '}
            <Link to="/login" style={{ color: '#8DC26F', fontWeight: 700 }}>Ingresar →</Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 0' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['', ...categorias].map(cat => (
            <button key={cat} onClick={() => setFiltro(cat)} style={{
              padding: '6px 18px', borderRadius: 100, border: '1.5px solid',
              borderColor: filtro === cat ? G : '#E8DCC8',
              background: filtro === cat ? G : '#FDFCF8',
              color: filtro === cat ? '#F5F0E4' : '#0F1E14',
              fontSize: '.78rem', cursor: 'pointer', fontWeight: 500, transition: 'all .15s',
            }}>
              {cat || 'Todos'}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 20 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ background: '#E8DCC8', borderRadius: 8, height: 280, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#6B8070' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
            Sin resultados. Probá con otro término o categoría.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 20, paddingBottom: 40 }}>
            {visible.map(p => {
              const { base, promo, final } = getPrecioConPromo(p);
              const esPrivado = !user && p.precioPublico !== p.precioGeneral;
              const tienePromo = !!promo && final < base;
              return (
                <div key={p.id} style={{ background: '#FDFCF8', borderRadius: 8, border: `1px solid ${tienePromo ? '#FFB74D' : '#E8DCC8'}`, overflow: 'hidden', transition: 'all .2s', cursor: 'default', position: 'relative' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 12px 28px rgba(26,61,40,.1)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  {/* Promo badge */}
                  {tienePromo && (
                    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2, background: '#E65100', color: '#fff', fontWeight: 800, fontSize: '.7rem', padding: '3px 8px', borderRadius: 4 }}>
                      {promo.tipo === '%' ? `-${promo.valor}%` : `-Q${promo.valor}`}
                    </div>
                  )}
                  <div style={{ height: 160, background: '#E8DCC8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', overflow: 'hidden' }}>
                    {p.foto
                      ? <img src={p.foto} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (p.emoji || '🌿')}
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '.95rem', color: G, marginBottom: 4 }}>{p.nombre}</div>
                    <div style={{ fontSize: '.78rem', color: '#6B8070', marginBottom: 10, lineHeight: 1.5, minHeight: 32 }}>
                      {p.descripcion || ''}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ filter: esPrivado ? 'blur(4px)' : 'none', userSelect: esPrivado ? 'none' : 'auto' }}>
                        {tienePromo && (
                          <div style={{ fontSize: '.75rem', color: '#aaa', textDecoration: 'line-through', lineHeight: 1.2 }}>
                            {fmtQ(base)}
                          </div>
                        )}
                        <div style={{ fontWeight: 800, fontSize: '.92rem', color: tienePromo ? '#E65100' : '#2D6645' }}>
                          {final ? `${fmtQ(final)} / ${p.unidad || 'unidad'}` : 'Consultar'}
                        </div>
                        {tienePromo && promo.nombre && (
                          <div style={{ fontSize: '.65rem', color: '#E65100', fontWeight: 600 }}>{promo.nombre}</div>
                        )}
                      </div>
                      <button onClick={() => addItem(p)} style={{ padding: '7px 14px', background: G, color: '#F5F0E4', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 }}>
                        + Agregar
                      </button>
                    </div>
                    {p.enStock === false && (
                      <div style={{ marginTop: 6, fontSize: '.7rem', color: '#C62828', fontWeight: 600 }}>✗ Sin disponibilidad</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
