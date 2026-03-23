import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import AddressForm from '../components/AddressForm.jsx';
import { db, doc, getDoc, addDoc, collection, serverTimestamp } from '../firebase.js';
import { nextCorrelativo } from '../utils/correlativo.js';
import { checkMinimo } from '../utils/precios.js';
import { fmtQ, fmtDate, today } from '../utils/format.js';
import { notifyNuevoPedido } from '../utils/mail.js';

const G        = '#1A3D28';
const IVA_RATE = 0.12;

const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#6B8070' };
const IS = { padding:'10px 12px', border:'1.5px solid #E8DCC8', borderRadius:4, fontSize:'.88rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

function fmtAddr(dir) {
  if (!dir) return '—';
  if (typeof dir === 'string') return dir;
  return [dir.direccion, dir.zona, dir.municipio, dir.departamento, dir.pais].filter(Boolean).join(', ');
}

export default function Checkout() {
  const { items, total, clear, isEmpty, setQty, remove } = useCart();
  const { user, cliente, tier }                          = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();

  const [config, setConfig]       = useState({});
  const [saving, setSaving]       = useState(false);
  const [editAddr, setEditAddr]   = useState(false);
  const [confirmed, setConfirmed] = useState(null); // { correlativo, items, neto, iva, total, sucursalNombre, fecha }

  const sucursales = cliente?.sucursales || [];
  const [sucursalId, setSucursalId] = useState('__principal__');

  const [form, setForm] = useState({
    nombre: '', empresa: '', nit: 'CF', telefono: '', email: '',
    direccion: { pais:'Guatemala', departamento:'', municipio:'', zona:'', direccion:'', referencias:'' },
    fechaEntrega: '', notas: '',
  });

  useEffect(() => {
    getDoc(doc(db, 't_config', 'tienda')).then(s => setConfig(s.exists() ? s.data() : {}));
  }, []);

  useEffect(() => {
    if (!cliente) return;
    setForm(f => ({
      ...f,
      nombre:    cliente.nombre   || '',
      empresa:   cliente.empresa  || '',
      nit:       cliente.nit      || 'CF',
      telefono:  cliente.telefono || '',
      email:     cliente.email    || user?.email || '',
      direccion: cliente.direccion || f.direccion,
    }));
  }, [cliente, user]);

  useEffect(() => {
    if (!cliente) return;
    if (sucursalId === '__principal__') {
      setForm(f => ({ ...f, direccion: cliente.direccion || f.direccion }));
    } else {
      const suc = sucursales.find(s => s.id === sucursalId);
      if (suc) setForm(f => ({ ...f, direccion: suc.direccion || f.direccion }));
    }
  }, [sucursalId, cliente]);   // eslint-disable-line

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const resolvedAddress = () => {
    if (sucursalId !== '__principal__') {
      const suc = sucursales.find(s => s.id === sucursalId);
      return suc?.direccion || form.direccion;
    }
    return form.direccion;
  };

  const neto = total / (1 + IVA_RATE);
  const iva  = total - neto;

  const handleSubmit = async () => {
    if (!form.nombre || !form.telefono) {
      toast('Nombre y teléfono son requeridos', 'error'); return;
    }
    const addr = resolvedAddress();
    if (!addr?.direccion) {
      toast('Dirección de entrega es requerida', 'error'); return;
    }
    if (!form.fechaEntrega) {
      toast('Seleccioná una fecha de entrega', 'error'); return;
    }
    if (isEmpty) { toast('No hay productos en la orden', 'error'); return; }

    const t = tier();
    const { ok, min } = checkMinimo(total, t, config);
    if (!ok) {
      toast(`Mínimo de compra: ${fmtQ(min)} para clientes ${t}`, 'warn'); return;
    }

    setSaving(true);
    try {
      const correlativo = await nextCorrelativo('OC');
      const sucursal    = sucursalId !== '__principal__' ? sucursales.find(s => s.id === sucursalId) : null;

      const orden = {
        correlativo,
        estado:         'nueva',
        fecha:          today(),
        fechaEntrega:   form.fechaEntrega,
        clienteUid:     user?.uid  || null,
        clienteId:      user?.uid  || null,
        clienteTier:    t,
        nombre:         form.nombre,
        empresa:        form.empresa,
        nit:            form.nit,
        telefono:       form.telefono,
        email:          form.email,
        direccion:      addr,
        direccionStr:   fmtAddr(addr),
        sucursalId:     sucursalId !== '__principal__' ? sucursalId : null,
        sucursalNombre: sucursal?.nombre || null,
        notas:          form.notas,
        items: items.map(i => ({
          productoId: i.id,
          nombre:     i.nombre,
          unidad:     i.unidad,
          precio:     i.precio,
          cantidad:   i.qty,
          subtotal:   i.precio * i.qty,
        })),
        neto:    parseFloat(neto.toFixed(2)),
        iva:     parseFloat(iva.toFixed(2)),
        total,
        pago:    { estado: 'pendiente', metodo: null, pagos: [] },
        factura: { estado: 'pendiente', correlativo: null, uuid: null, xmlUrl: null },
        entrega: { estado: 'pendiente', transportista: null, rutaId: null, fechaReal: null, firmaUrl: null },
        creadoEn: serverTimestamp(),
      };

      await addDoc(collection(db, 't_ordenes'), orden);
      notifyNuevoPedido(orden);

      // Show confirmed OC instead of navigating away
      setConfirmed({
        correlativo,
        fecha:          today(),
        fechaEntrega:   form.fechaEntrega,
        nombre:         form.nombre,
        empresa:        form.empresa,
        nit:            form.nit,
        sucursalNombre: sucursal?.nombre || 'Dirección principal',
        direccionStr:   fmtAddr(addr),
        items:          [...items],
        neto:           parseFloat(neto.toFixed(2)),
        iva:            parseFloat(iva.toFixed(2)),
        total,
      });
      clear();
    } catch (e) {
      console.error(e);
      toast('Error al enviar pedido. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── SUCCESS / CONFIRMED VIEW ────────────────────────────────────────────
  if (confirmed) {
    return (
      <div style={{ maxWidth: 860, margin: '32px auto', padding: '0 24px 60px' }}>
        {/* Success badge */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#E8F5E9', border: '1.5px solid #4A9E6A', borderRadius: 8, padding: '12px 24px' }}>
            <span style={{ fontSize: '1.4rem' }}>✓</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.05rem', color: G }}>Orden de Compra Generada</div>
              <div style={{ fontSize: '.78rem', color: '#4A9E6A', marginTop: 2 }}>Se ha enviado confirmación por email</div>
            </div>
          </div>
        </div>

        {/* OC Document */}
        <div style={{ background: '#fff', border: `2px solid ${G}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>

          {/* Header */}
          <div style={{ background: G, color: '#F5F0E4', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>🌿 AGROINDUSTRIA AJÚA</div>
              <div style={{ fontSize: '.72rem', opacity: .65, marginTop: 2 }}>Proveedor de vegetales frescos · Guatemala</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '.72rem', opacity: .65 }}>ORDEN DE COMPRA</div>
              <div style={{ fontWeight: 900, fontSize: '1.4rem', letterSpacing: '.02em', color: '#8DC26F' }}>{confirmed.correlativo}</div>
              <div style={{ fontSize: '.72rem', opacity: .65 }}>Fecha: {fmtDate(confirmed.fecha)}</div>
            </div>
          </div>

          {/* Client info */}
          <div style={{ padding: '16px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px', borderBottom: '1px solid #E8DCC8', background: '#FDFCF8' }}>
            <InfoCell label="Cliente"           value={confirmed.nombre} />
            <InfoCell label="Empresa"           value={confirmed.empresa || '—'} />
            <InfoCell label="NIT"               value={confirmed.nit || 'CF'} />
            <InfoCell label="Punto de entrega"  value={confirmed.sucursalNombre} />
            <InfoCell label="Dirección"         value={confirmed.direccionStr || '—'} span />
            <InfoCell label="Fecha de entrega"  value={fmtDate(confirmed.fechaEntrega)} />
            <InfoCell label="Estado"            value={<span style={{ background:'#E3F2FD', color:'#1565C0', fontWeight:700, fontSize:'.78rem', padding:'2px 8px', borderRadius:4 }}>Nueva</span>} />
          </div>

          {/* Items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F5F5F0', borderBottom: '1px solid #E8DCC8' }}>
                {['#', 'Producto', 'Unidad', 'Cant.', 'P. Unitario', 'P. Total'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6B8070', textAlign: ['P. Unitario','P. Total'].includes(h) ? 'right' : ['Cant.'].includes(h) ? 'center' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {confirmed.items.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F0EBE0', background: i % 2 ? '#FAFAF7' : '#fff' }}>
                  <td style={{ padding: '10px 12px', fontSize: '.78rem', color: '#aaa', width: 32 }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: '.88rem', color: G }}>{item.nombre}</td>
                  <td style={{ padding: '10px 12px', fontSize: '.82rem', color: '#6B8070' }}>{item.unidad}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: '.88rem' }}>{item.qty}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '.85rem', color: '#555' }}>{fmtQ(item.precio)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '.9rem', color: G }}>{fmtQ(item.precio * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ padding: '16px 28px', borderTop: '2px solid #E8DCC8', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 260 }}>
              <TotalRow label="Subtotal (neto)" value={fmtQ(confirmed.neto)} />
              <TotalRow label="IVA (12%)"       value={fmtQ(confirmed.iva)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem', color: G, paddingTop: 10, borderTop: '2px solid #E8DCC8', marginTop: 6 }}>
                <span>TOTAL</span>
                <span>{fmtQ(confirmed.total)}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div style={{ padding: '12px 28px', background: '#F5F5F0', borderTop: '1px solid #E8DCC8', fontSize: '.75rem', color: '#6B8070' }}>
            📋 El método de pago se coordinará directamente. Te avisaremos por email cuando la orden sea confirmada y cuando vaya en ruta.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
          <button onClick={() => window.print()} style={{ padding: '10px 22px', background: '#F5F5F0', border: '1px solid #D0C8B4', borderRadius: 4, fontSize: '.83rem', fontWeight: 600, cursor: 'pointer', color: '#555' }}>
            🖨 Imprimir OC
          </button>
          <button onClick={() => navigate('/cuenta/ordenes')} style={{ padding: '10px 22px', background: G, color: '#F5F0E4', border: 'none', borderRadius: 4, fontSize: '.83rem', fontWeight: 700, cursor: 'pointer' }}>
            Ver mis órdenes →
          </button>
          <button onClick={() => navigate('/')} style={{ padding: '10px 22px', background: '#4A9E6A', color: '#fff', border: 'none', borderRadius: 4, fontSize: '.83rem', fontWeight: 700, cursor: 'pointer' }}>
            Nuevo pedido
          </button>
        </div>
      </div>
    );
  }

  // ── EMPTY CART ───────────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 24px', color: '#6B8070' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
        <p>No hay productos en la orden.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '10px 24px', background: G, color: '#F5F0E4', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
          Ir al catálogo
        </button>
      </div>
    );
  }

  // ── OC CONFIRMATION FORM ─────────────────────────────────────────────────
  const minPublico = config.minCompra_publico ?? 500;
  const underMin   = !user && total < minPublico;
  const addr       = resolvedAddress();
  const addrStr    = fmtAddr(addr);
  const isLoggedIn = !!user && !!cliente;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 48px' }}>

      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: '#6B8070', marginBottom: 4 }}>Agroindustria AJÚA</div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: G, margin: 0 }}>Revisión de Orden de Compra</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: OC Document ── */}
        <div>

          {/* OC header block */}
          <div style={{ background: '#FDFCF8', border: `2px solid ${G}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ background: G, color: '#F5F0E4', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '.92rem' }}>🌿 AGROINDUSTRIA AJÚA</div>
                <div style={{ fontSize: '.68rem', opacity: .6 }}>Orden de Compra · {today()}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '.72rem', opacity: .75 }}>
                <div style={{ fontWeight: 700 }}>Pendiente de confirmación</div>
                <div style={{ opacity: .6, marginTop: 1 }}>Nº se asigna al confirmar</div>
              </div>
            </div>
            <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 24px', borderBottom: '1px solid #E8DCC8', fontSize: '.8rem' }}>
              {isLoggedIn ? (
                <>
                  <InfoCell label="Cliente"   value={form.nombre} />
                  <InfoCell label="Empresa"   value={form.empresa || '—'} />
                  <InfoCell label="NIT"       value={form.nit || 'CF'} />
                  <InfoCell label="Teléfono"  value={form.telefono || '—'} />
                  <InfoCell label="Dirección" value={addrStr || <span style={{ color:'#C62828' }}>Sin dirección</span>} span />
                </>
              ) : (
                <>
                  <InfoCell label="Cliente"  value={form.nombre  || <span style={{ color:'#aaa' }}>—</span>} />
                  <InfoCell label="Empresa"  value={form.empresa || '—'} />
                  <InfoCell label="NIT"      value={form.nit     || 'CF'} />
                  <InfoCell label="Teléfono" value={form.telefono || '—'} />
                </>
              )}
            </div>
          </div>

          {/* Items table */}
          <div style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: G }}>
                  {['Producto', 'Unidad', 'Cant.', 'P. Unitario', 'P. Total', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', color: '#F5F0E4', fontSize: '.68rem', fontWeight: 700, textAlign: ['P. Unitario','P. Total'].includes(h) ? 'right' : ['Cant.'].includes(h) ? 'center' : 'left', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ background: i % 2 ? '#F9F7F2' : '#FDFCF8', borderBottom: '1px solid #F0EBE0' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600, fontSize: '.85rem', color: G }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {item.foto && <img src={item.foto} alt="" style={{ width: 28, height: 28, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />}
                        {item.nombre}
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: '.8rem', color: '#6B8070' }}>{item.unidad}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', borderRadius: 5, padding: '2px 6px', border: '1px solid #D0C8B4' }}>
                        <button onClick={() => setQty(item.id, item.qty - 1)} style={{ ...QBtn, color: item.qty <= 1 ? '#ccc' : '#C62828' }}>−</button>
                        <span style={{ fontSize: '.9rem', fontWeight: 700, minWidth: 22, textAlign: 'center' }}>{item.qty}</span>
                        <button onClick={() => setQty(item.id, item.qty + 1)} style={{ ...QBtn, color: '#4A9E6A' }}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: '.85rem', color: '#555' }}>{fmtQ(item.precio)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, fontSize: '.88rem', color: G }}>{fmtQ(item.precio * item.qty)}</td>
                    <td style={{ padding: '9px 6px', textAlign: 'center' }}>
                      <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '.78rem', opacity: .6, padding: '2px 4px' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 8, padding: '14px 20px', maxWidth: 320, marginLeft: 'auto' }}>
            <TotalRow label="Subtotal (neto)" value={fmtQ(neto)} />
            <TotalRow label="IVA (12%)"       value={fmtQ(iva)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.05rem', color: G, paddingTop: 8, borderTop: '2px solid #E8DCC8', marginTop: 4 }}>
              <span>Total</span>
              <span>{fmtQ(total)}</span>
            </div>
          </div>

          {underMin && (
            <div style={{ marginTop: 12, padding: '9px 14px', background: '#FFF3E0', border: '1px solid #E65100', borderRadius: 6, fontSize: '.8rem', color: '#E65100', fontWeight: 600 }}>
              ⚠ Mínimo de compra público: {fmtQ(minPublico)}. Falta {fmtQ(minPublico - total)}.
            </div>
          )}
        </div>

        {/* ── RIGHT: Confirm panel ── */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 8, padding: 18 }}>
            <div style={{ fontWeight: 800, color: G, marginBottom: 14, fontSize: '.88rem' }}>
              {isLoggedIn ? 'Confirmar pedido' : 'Datos del pedido'}
            </div>

            {isLoggedIn ? (
              <>
                {/* Sucursal */}
                <label style={{ ...LS, marginBottom: 12 }}>
                  Punto de entrega
                  <select value={sucursalId} onChange={e => { setSucursalId(e.target.value); setEditAddr(false); }}
                    style={{ ...IS, borderColor: sucursalId !== '__principal__' ? G : '#E8DCC8' }}>
                    <option value="__principal__">📍 Dirección principal</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>🏢 {s.nombre}</option>)}
                  </select>
                </label>

                {/* Address display / override */}
                {!editAddr ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ background: '#F5F5F0', borderRadius: 5, padding: '7px 11px', fontSize: '.8rem', color: '#333', lineHeight: 1.5, marginTop: 2 }}>
                      {addrStr || <span style={{ color:'#C62828' }}>Sin dirección</span>}
                    </div>
                    <button onClick={() => setEditAddr(true)}
                      style={{ marginTop: 5, padding: '3px 9px', background: 'transparent', border: '1px solid #D0C8B4', borderRadius: 4, fontSize: '.72rem', color: '#555', cursor: 'pointer', fontWeight: 600 }}>
                      ✏ Cambiar
                    </button>
                    {!addr?.direccion && (
                      <div style={{ marginTop: 5, fontSize: '.75rem', color: '#C62828', fontWeight: 600 }}>
                        ⚠ <Link to="/cuenta/perfil" style={{ color:'#C62828' }}>Completar perfil →</Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <AddressForm value={addr} onChange={v => sf('direccion', v)} required />
                    <button onClick={() => setEditAddr(false)}
                      style={{ marginTop: 5, padding: '3px 9px', background: 'transparent', border: '1px solid #D0C8B4', borderRadius: 4, fontSize: '.72rem', color: '#555', cursor: 'pointer' }}>
                      ✓ Usar esta
                    </button>
                  </div>
                )}

                <label style={{ ...LS, marginBottom: 12 }}>
                  Fecha de entrega *
                  <input type="date" value={form.fechaEntrega} min={today()} onChange={e => sf('fechaEntrega', e.target.value)} style={IS} />
                </label>

                <label style={{ ...LS, marginBottom: 14 }}>
                  Notas
                  <textarea value={form.notas} onChange={e => sf('notas', e.target.value)} rows={2}
                    style={{ ...IS, resize: 'vertical' }} placeholder="Horario, instrucciones..." />
                </label>

                <Link to="/cuenta/perfil" style={{ display: 'block', textAlign: 'center', fontSize: '.72rem', color: '#4A9E6A', fontWeight: 600, textDecoration: 'none', marginBottom: 12 }}>
                  ✏ Actualizar mis datos →
                </Link>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
                  <label style={{ ...LS, marginBottom: 10, gridColumn: 'span 2' }}>Nombre *<input value={form.nombre} onChange={e => sf('nombre', e.target.value)} style={IS} /></label>
                  <label style={{ ...LS, marginBottom: 10 }}>Empresa<input value={form.empresa} onChange={e => sf('empresa', e.target.value)} style={IS} /></label>
                  <label style={{ ...LS, marginBottom: 10 }}>NIT<input value={form.nit} onChange={e => sf('nit', e.target.value)} style={IS} /></label>
                  <label style={{ ...LS, marginBottom: 10 }}>Teléfono *<input value={form.telefono} onChange={e => sf('telefono', e.target.value)} style={IS} /></label>
                  <label style={{ ...LS, marginBottom: 10 }}>Email<input type="email" value={form.email} onChange={e => sf('email', e.target.value)} style={IS} /></label>
                </div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#6B8070', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Dirección de entrega</div>
                <AddressForm value={form.direccion} onChange={v => sf('direccion', v)} required />
                <label style={{ ...LS, marginTop: 10, marginBottom: 10 }}>Fecha de entrega *<input type="date" value={form.fechaEntrega} min={today()} onChange={e => sf('fechaEntrega', e.target.value)} style={IS} /></label>
                <label style={{ ...LS, marginBottom: 14 }}>Notas<textarea value={form.notas} onChange={e => sf('notas', e.target.value)} rows={2} style={{ ...IS, resize:'vertical' }} /></label>
              </>
            )}

            {/* Mini totals */}
            <div style={{ background: '#F5F5F0', borderRadius: 5, padding: '9px 12px', marginBottom: 12, fontSize: '.78rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', color:'#6B8070', marginBottom:2 }}><span>Subtotal neto</span><span>{fmtQ(neto)}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', color:'#6B8070', marginBottom:6 }}><span>IVA 12%</span><span>{fmtQ(iva)}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:'.92rem', color:G }}><span>Total</span><span>{fmtQ(total)}</span></div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving || underMin}
              style={{ width:'100%', padding:'13px', background:(saving||underMin)?'#ccc':G, color:'#F5F0E4', border:'none', borderRadius:4, fontWeight:800, fontSize:'.88rem', cursor:(saving||underMin)?'not-allowed':'pointer' }}
            >
              {saving ? 'Generando OC...' : isLoggedIn ? '✓ Confirmar Orden de Compra' : 'Generar Orden →'}
            </button>

            <div style={{ marginTop: 8, fontSize: '.7rem', color: '#aaa', textAlign: 'center' }}>📋 Pago se coordina al confirmar</div>
          </div>
        </div>

      </div>
    </div>
  );
}

function InfoCell({ label, value, span }) {
  return (
    <div style={{ gridColumn: span ? 'span 2' : undefined }}>
      <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6B8070' }}>{label}</div>
      <div style={{ fontSize: '.82rem', color: '#1A1A18', marginTop: 1 }}>{value}</div>
    </div>
  );
}

function TotalRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: '#6B8070', marginBottom: 4 }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

const QBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '1rem', fontWeight: 900, padding: '0 1px', lineHeight: 1,
  display: 'flex', alignItems: 'center',
};
