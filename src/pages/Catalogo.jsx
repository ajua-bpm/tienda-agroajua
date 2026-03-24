import { useState, useMemo, useEffect } from 'react';
import { useCollection } from '../hooks/useFirestore.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { db, doc, onSnapshot } from '../firebase.js';
import { fmtQ } from '../utils/format.js';
import { Link, useNavigate } from 'react-router-dom';

const G = '#1A3D28', ACC = '#4A9E6A';
const IVA_RATE = 0.12;

export default function Catalogo() {
  const { user, cliente } = useAuth();
  const { items, add, setQty, remove, total, count } = useCart();
  const toast    = useToast();
  const navigate = useNavigate();

  const { data: productos,     loading } = useCollection('t_productos',      { orderField:'nombre', limitN:300 });
  const { data: presentaciones }         = useCollection('t_presentaciones', { orderField:'descripcion', limitN:500 });

  const [lista,    setLista]    = useState(null);
  const [filtro,   setFiltro]   = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Sucursal selector for cart
  const sucursales = cliente?.sucursales?.filter(s => s.activa !== false) || [];
  const [sucursalId, setSucursalId] = useState('');

  useEffect(() => {
    if (!user) { setLista(null); return; }
    const lId = cliente?.listaId || 'general';
    const unsub = onSnapshot(doc(db, 't_listas', lId), s => {
      setLista(s.exists() ? { id: s.id, ...s.data() } : null);
    });
    return unsub;
  }, [user, cliente?.listaId]);

  // Build price map: presentacionId → precio (new) or productoId → precio (legacy items without presentacionId)
  const priceMap = useMemo(() => {
    const m = {};
    if (!lista?.items) return m;
    for (const item of lista.items) {
      if (item.activo === false) continue;
      if (item.presentacionId) m[item.presentacionId] = item.precio;
      else if (item.productoId) m[item.productoId] = item.precio;
    }
    return m;
  }, [lista]);

  // Group presentations by product
  const presByProd = useMemo(() => {
    const m = {};
    for (const p of presentaciones) {
      if (p.activo === false) continue;
      if (!m[p.productoId]) m[p.productoId] = [];
      m[p.productoId].push(p);
    }
    return m;
  }, [presentaciones]);

  const categorias = useMemo(() =>
    [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort(),
    [productos]
  );

  const visible = useMemo(() => {
    let list = productos.filter(p => p.activo !== false);

    // Cuando el cliente está logueado y tiene lista asignada:
    // mostrar SOLO productos que están en su lista con precio definido
    if (user && lista) {
      list = list.filter(prod => {
        const pres = presByProd[prod.id] || [];
        if (pres.length > 0) return pres.some(p => priceMap[p.id] !== undefined);
        return priceMap[prod.id] !== undefined; // legacy productoId
      });
    }

    if (filtro)   list = list.filter(p => p.categoria === filtro);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    }

    // Orden alfabético
    return [...list].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  }, [productos, filtro, busqueda, user, lista, priceMap, presByProd]);

  const grupos = useMemo(() => {
    const map = {};
    for (const p of visible) {
      const cat = p.categoria || 'Sin categoría';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b));
  }, [visible]);

  // Get price for a presentation
  const getPrecio = (presId) => {
    if (!user) return null;
    return priceMap[presId] || null;
  };

  // Has any presentation with price (for "Precio especial" badge)
  const tienePrecioEspecial = (prod) => {
    const pres = presByProd[prod.id] || [];
    return pres.some(p => priceMap[p.id] !== undefined);
  };

  // Cart helpers — keyed by presentacionId
  const getCartQty = (presId) => items.find(i => i.id === presId)?.qty || 0;

  const handleSetQty = (pres, prod, precio, newQty) => {
    const qty = Math.max(0, parseInt(newQty) || 0);
    const cur = items.find(i => i.id === pres.id);
    if (qty === 0) { if (cur) remove(pres.id); return; }
    if (cur) setQty(pres.id, qty);
    else add(
      { id: pres.id, nombre: prod.nombre, descripcion: pres.descripcion, unidad: pres.unidad, foto: prod.foto || '', sku: pres.sku || prod.sku || '' },
      precio,
      qty,
      sucursalId || null,
      sucursalId ? sucursales.find(s => s.id === sucursalId)?.nombre || '' : ''
    );
  };

  // Legacy (products without presentations): treat product as its own "presentation"
  const handleSetQtyLegacy = (prod, precio, newQty) => {
    const qty = Math.max(0, parseInt(newQty) || 0);
    const legacyPrice = precio || (user ? prod.precioGeneral : prod.precioPublico) || 0;
    const cur = items.find(i => i.id === prod.id);
    if (qty === 0) { if (cur) remove(prod.id); return; }
    if (cur) setQty(prod.id, qty);
    else add(
      { id: prod.id, nombre: prod.nombre, descripcion: prod.descripcion || '', unidad: prod.unidad || '—', foto: prod.foto || '', sku: prod.sku || '' },
      legacyPrice,
      qty,
      sucursalId || null,
      sucursalId ? sucursales.find(s => s.id === sucursalId)?.nombre || '' : ''
    );
  };

  const neto = total / (1 + IVA_RATE);
  const iva  = total - neto;

  const irAOC = () => {
    if (count === 0) { toast('Seleccioná al menos un producto', 'warn'); return; }
    navigate('/checkout');
  };

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3EF' }}>

      {/* ── Top bar ── */}
      <div style={{ background:G, position:'sticky', top:58, zIndex:100 }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'12px 28px 0' }}>
          <div style={{ display:'flex', gap:8, maxWidth:440, marginBottom:10 }}>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto, SKU…"
              style={{ flex:1, padding:'8px 14px', border:'none', borderRadius:4, fontSize:'.85rem', outline:'none', background:'rgba(255,255,255,.15)', color:'#F5F0E4' }} />
            {busqueda && <button onClick={() => setBusqueda('')} style={{ padding:'8px 11px', background:'rgba(255,255,255,.1)', border:'none', borderRadius:4, color:'#F5F0E4', cursor:'pointer' }}>✕</button>}
          </div>
          <div style={{ display:'flex', gap:0, overflowX:'auto' }}>
            {['', ...categorias].map(cat => (
              <button key={cat} onClick={() => setFiltro(cat)} style={{
                padding:'7px 18px', border:'none', cursor:'pointer',
                fontWeight:600, fontSize:'.78rem', whiteSpace:'nowrap',
                background: filtro===cat?'#FDFCF8':'transparent',
                color: filtro===cat?G:'rgba(245,240,228,.75)',
                borderRadius: filtro===cat?'4px 4px 0 0':0,
                transition:'all .1s',
              }}>
                {cat || 'Todos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Login banner */}
      {!user && (
        <div style={{ background:'#1B4D32', color:'rgba(245,240,228,.8)', padding:'7px 28px', fontSize:'.78rem', textAlign:'center' }}>
          Precios privados para clientes registrados.{' '}
          <Link to="/login" style={{ color:'#8DC26F', fontWeight:700, textDecoration:'none' }}>Ingresar →</Link>
        </div>
      )}

      {/* Sucursal selector (if client has branches) */}
      {user && sucursales.length > 0 && (
        <div style={{ background:'#FDFCF8', borderBottom:'1px solid #E8DCC8', padding:'8px 28px', display:'flex', alignItems:'center', gap:10, fontSize:'.82rem' }}>
          <span style={{ color:'#888', fontWeight:600 }}>Entregar en:</span>
          <select value={sucursalId} onChange={e => setSucursalId(e.target.value)}
            style={{ padding:'5px 10px', border:'1.5px solid #E0DDD5', borderRadius:5, fontSize:'.82rem', outline:'none', fontFamily:'inherit', color:G, fontWeight:sucursalId?700:400 }}>
            <option value="">Sucursal principal</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Product table */}
      <div style={{ maxWidth:1200, margin:'0 auto', paddingBottom: count>0?110:40 }}>
        {loading ? (
          <div style={{ padding:'60px 28px', textAlign:'center', color:'#6B8070' }}>Cargando catálogo…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding:'80px 28px', textAlign:'center', color:'#6B8070' }}>Sin resultados.</div>
        ) : (
          grupos.map(([cat, prods]) => (
            <div key={cat}>
              <div style={{ padding:'14px 28px 4px', fontSize:'.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.1em', color:'#6B8070' }}>{cat}</div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #E8DCC8', background:'#FDFCF8' }}>
                    <th style={TH}>Producto / Presentación</th>
                    <th style={{ ...TH, width:90 }}>Unidad</th>
                    <th style={{ ...TH, width:130, textAlign:'right' }}>Precio unit.</th>
                    <th style={{ ...TH, width:150, textAlign:'center' }}>Cantidad</th>
                    <th style={{ ...TH, width:120, textAlign:'right', paddingRight:28 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {prods.map(prod => {
                    const pres = presByProd[prod.id] || [];
                    const especial = user && tienePrecioEspecial(prod);

                    // Products WITH presentations
                    if (pres.length > 0) {
                      // Si está logueado: mostrar solo presentaciones con precio en su lista
                      const presVisible = (user && lista)
                        ? pres.filter(p => priceMap[p.id] !== undefined)
                        : pres;
                      if (presVisible.length === 0) return null;
                      return presVisible.map((p, pi) => {
                        const precio = getPrecio(p.id);
                        const qty    = getCartQty(p.id);
                        const active = qty > 0;
                        const displayPrecio = precio !== null ? precio : (!user ? prod.precioPublico : null);

                        return (
                          <tr key={p.id} style={{ borderBottom:'1px solid #EDE9E1', background:active?'#EDF7F1':'#FDFCF8', transition:'background .1s' }}>
                            <td style={{ padding:'8px 8px 8px 28px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                {pi === 0 && (
                                  <div style={{ width:32, height:32, borderRadius:4, background:'#E8DCC8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0, overflow:'hidden' }}>
                                    {prod.foto ? <img src={prod.foto} alt={prod.nombre} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : null}
                                  </div>
                                )}
                                {pi > 0 && <div style={{ width:32, flexShrink:0 }} />}
                                <div>
                                  {pi === 0 && (
                                    <div style={{ fontWeight:700, fontSize:'.87rem', color:active?G:'#333' }}>
                                      {prod.nombre}
                                      {especial && <span style={{ marginLeft:6, fontSize:'.62rem', background:'#E8F5E9', color:G, borderRadius:3, padding:'1px 5px', fontWeight:700 }}>PRECIO ESPECIAL</span>}
                                    </div>
                                  )}
                                  <div style={{ fontSize:'.75rem', color:'#6B8070' }}>{p.descripcion}</div>
                                  {prod.enStock === false && pi===0 && <span style={{ fontSize:'.68rem', color:'#C62828', fontWeight:700 }}>✗ Sin stock</span>}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding:'8px', fontSize:'.82rem', color:'#6B8070' }}>{p.unidad||'—'}</td>
                            <td style={{ padding:'8px', textAlign:'right' }}>
                              {!displayPrecio ? (
                                <span style={{ fontSize:'.78rem', color:'#aaa' }}>Consultar</span>
                              ) : (
                                <span style={{ fontWeight:700, fontSize:'.88rem', color:'#2D6645' }}>{fmtQ(displayPrecio)}</span>
                              )}
                            </td>
                            <td style={{ padding:'8px', textAlign:'center' }}>
                              {(!displayPrecio || prod.enStock === false) ? (
                                <span style={{ fontSize:'.75rem', color:'#ccc' }}>—</span>
                              ) : (
                                <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:active?'#fff':'#F0EDE6', borderRadius:6, padding:'3px 8px', border:`1.5px solid ${active?ACC:'#D8D2C8'}` }}>
                                  <button onClick={() => handleSetQty(p, prod, displayPrecio, qty-1)} style={{ ...QBtn, color:qty<=1?'#ccc':'#C62828' }}>−</button>
                                  <input type="number" min="0" value={qty||''} placeholder="0"
                                    onChange={e => handleSetQty(p, prod, displayPrecio, e.target.value)}
                                    style={{ width:34, textAlign:'center', border:'none', background:'transparent', fontSize:'.92rem', fontWeight:700, color:active?G:'#888', outline:'none', padding:0 }} />
                                  <button onClick={() => handleSetQty(p, prod, displayPrecio, qty+1)} style={{ ...QBtn, color:ACC }}>+</button>
                                </div>
                              )}
                            </td>
                            <td style={{ padding:'8px 28px 8px 8px', textAlign:'right' }}>
                              {active
                                ? <span style={{ fontWeight:800, fontSize:'.9rem', color:G }}>{fmtQ(displayPrecio * qty)}</span>
                                : <span style={{ color:'#ddd', fontSize:'.82rem' }}>—</span>
                              }
                            </td>
                          </tr>
                        );
                      });
                    }

                    // Legacy product (no presentations)
                    const legacyPrecio = user ? (priceMap[prod.id] ?? prod.precioGeneral ?? null) : prod.precioPublico;
                    const qty    = getCartQty(prod.id);
                    const active = qty > 0;
                    return (
                      <tr key={prod.id} style={{ borderBottom:'1px solid #EDE9E1', background:active?'#EDF7F1':'#FDFCF8', transition:'background .1s' }}>
                        <td style={{ padding:'9px 8px 9px 28px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:34, height:34, borderRadius:4, background:'#E8DCC8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0, overflow:'hidden' }}>
                              {prod.foto ? <img src={prod.foto} alt={prod.nombre} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : null}
                            </div>
                            <div>
                              <div style={{ fontWeight:700, fontSize:'.87rem', color:active?G:'#333' }}>{prod.nombre}</div>
                              {prod.descripcion && <div style={{ fontSize:'.72rem', color:'#6B8070' }}>{prod.descripcion}</div>}
                              {prod.enStock===false && <span style={{ fontSize:'.68rem', color:'#C62828', fontWeight:700 }}>✗ Sin stock</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'9px 8px', fontSize:'.82rem', color:'#6B8070' }}>{prod.unidad||'—'}</td>
                        <td style={{ padding:'9px 8px', textAlign:'right' }}>
                          {!legacyPrecio ? (
                            <span style={{ fontSize:'.78rem', color:'#aaa' }}>Consultar</span>
                          ) : (
                            <span style={{ fontWeight:700, fontSize:'.88rem', color:'#2D6645' }}>{fmtQ(legacyPrecio)}</span>
                          )}
                        </td>
                        <td style={{ padding:'9px 8px', textAlign:'center' }}>
                          {(!legacyPrecio || prod.enStock===false) ? (
                            <span style={{ fontSize:'.75rem', color:'#ccc' }}>—</span>
                          ) : (
                            <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:active?'#fff':'#F0EDE6', borderRadius:6, padding:'3px 8px', border:`1.5px solid ${active?ACC:'#D8D2C8'}` }}>
                              <button onClick={() => handleSetQtyLegacy(prod, legacyPrecio, qty-1)} style={{ ...QBtn, color:qty<=1?'#ccc':'#C62828' }}>−</button>
                              <input type="number" min="0" value={qty||''} placeholder="0"
                                onChange={e => handleSetQtyLegacy(prod, legacyPrecio, e.target.value)}
                                style={{ width:34, textAlign:'center', border:'none', background:'transparent', fontSize:'.92rem', fontWeight:700, color:active?G:'#888', outline:'none', padding:0 }} />
                              <button onClick={() => handleSetQtyLegacy(prod, legacyPrecio, qty+1)} style={{ ...QBtn, color:ACC }}>+</button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding:'9px 28px 9px 8px', textAlign:'right' }}>
                          {active
                            ? <span style={{ fontWeight:800, fontSize:'.9rem', color:G }}>{fmtQ(legacyPrecio * qty)}</span>
                            : <span style={{ color:'#ddd', fontSize:'.82rem' }}>—</span>
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

      {/* Sticky OC bar */}
      {count > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200, background:G, color:'#F5F0E4', boxShadow:'0 -4px 24px rgba(0,0,0,.35)', padding:'12px 28px' }}>
          <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', gap:24 }}>
            <div style={{ flex:1, display:'flex', gap:28, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ fontSize:'.8rem' }}>
                <strong style={{ color:'#8DC26F', fontSize:'1.05rem' }}>{count}</strong>
                <span style={{ opacity:.65, marginLeft:4 }}>productos</span>
              </div>
              <div style={{ display:'flex', gap:20, fontSize:'.82rem' }}>
                <span style={{ opacity:.65 }}>Neto: <strong>{fmtQ(neto)}</strong></span>
                <span style={{ opacity:.65 }}>IVA 12%: <strong>{fmtQ(iva)}</strong></span>
                <span style={{ fontWeight:900, fontSize:'1rem' }}>Total: <strong style={{ color:'#8DC26F' }}>{fmtQ(total)}</strong></span>
              </div>
            </div>
            <button onClick={irAOC} style={{ padding:'11px 28px', background:ACC, color:'#fff', border:'none', borderRadius:4, fontWeight:800, fontSize:'.9rem', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              Generar Orden de Compra →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TH = {
  padding:'8px 8px 8px 28px', fontSize:'.69rem', fontWeight:700,
  textTransform:'uppercase', letterSpacing:'.06em', color:'#6B8070', textAlign:'left',
};
const QBtn = {
  background:'none', border:'none', cursor:'pointer', fontSize:'1rem', fontWeight:900, padding:'0 2px', lineHeight:1, display:'flex', alignItems:'center',
};
