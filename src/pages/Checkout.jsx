import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import AddressForm from '../components/AddressForm.jsx';
import { db, doc, getDoc, addDoc, collection, serverTimestamp } from '../firebase.js';
import { nextCorrelativo } from '../utils/correlativo.js';
import { checkMinimo } from '../utils/precios.js';
import { fmtQ, today } from '../utils/format.js';
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

  const [config, setConfig]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [editAddr, setEditAddr] = useState(false);

  const sucursales = cliente?.sucursales || [];
  const [sucursalId, setSucursalId] = useState('__principal__');

  const [form, setForm] = useState({
    nombre:       '',
    empresa:      '',
    nit:          'CF',
    telefono:     '',
    email:        '',
    direccion:    { pais:'Guatemala', departamento:'', municipio:'', zona:'', direccion:'', referencias:'' },
    fechaEntrega: '',
    notas:        '',
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
      toast('Selecciona una fecha de entrega', 'error'); return;
    }
    if (isEmpty) { toast('El carrito está vacío', 'error'); return; }

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
        estado:       'nueva',
        fecha:        today(),
        fechaEntrega: form.fechaEntrega,
        clienteUid:   user?.uid  || null,
        clienteId:    user?.uid  || null,
        clienteTier:  t,
        nombre:       form.nombre,
        empresa:      form.empresa,
        nit:          form.nit,
        telefono:     form.telefono,
        email:        form.email,
        direccion:    addr,
        direccionStr: fmtAddr(addr),
        sucursalId:   sucursalId !== '__principal__' ? sucursalId : null,
        sucursalNombre: sucursal?.nombre || null,
        notas:        form.notas,
        items: items.map(i => ({
          productoId: i.id,
          nombre:     i.nombre,
          unidad:     i.unidad,
          precio:     i.precio,
          cantidad:   i.qty,
          subtotal:   i.precio * i.qty,
        })),
        neto:     parseFloat(neto.toFixed(2)),
        iva:      parseFloat(iva.toFixed(2)),
        total,
        pago:    { estado: 'pendiente', metodo: null, pagos: [] },
        factura: { estado: 'pendiente', correlativo: null, uuid: null, xmlUrl: null },
        entrega: { estado: 'pendiente', transportista: null, rutaId: null, fechaReal: null, firmaUrl: null },
        creadoEn: serverTimestamp(),
      };

      await addDoc(collection(db, 't_ordenes'), orden);
      clear();
      notifyNuevoPedido(orden);
      toast(`✓ Orden ${correlativo} enviada`);
      navigate('/cuenta/ordenes');
    } catch (e) {
      console.error(e);
      toast('Error al enviar pedido. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isEmpty) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 24px', color: '#6B8070' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🛒</div>
        <p>Tu carrito está vacío.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '10px 24px', background: G, color: '#F5F0E4', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
          Ver catálogo
        </button>
      </div>
    );
  }

  const minPublico = config.minCompra_publico ?? 500;
  const underMin   = !user && total < minPublico;
  const addr       = resolvedAddress();
  const addrStr    = fmtAddr(addr);
  const isLoggedIn = !!user && !!cliente;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 48px' }}>

      {/* Page title */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: '#6B8070', marginBottom: 4 }}>
          Agroindustria AJÚA
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: G, margin: 0 }}>Orden de Compra</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: OC Document ── */}
        <div>

          {/* OC header */}
          <div style={{ background: '#FDFCF8', border: `2px solid ${G}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ background: G, color: '#F5F0E4', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '.95rem' }}>🌿 AGROINDUSTRIA AJÚA</div>
                <div style={{ fontSize: '.7rem', opacity: .65 }}>Orden de Compra · {today()}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '.75rem', opacity: .8 }}>
                <div style={{ fontWeight: 700 }}>Pendiente de confirmación</div>
                {isLoggedIn && <div style={{ marginTop: 2, fontSize: '.68rem', opacity: .7 }}>Se asignará # al confirmar</div>}
              </div>
            </div>

            {/* Client info row */}
            <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: '.8rem', borderBottom: `1px solid #E8DCC8` }}>
              {isLoggedIn ? (
                <>
                  <InfoCell label="Cliente"  value={form.nombre} />
                  <InfoCell label="Empresa"  value={form.empresa || '—'} />
                  <InfoCell label="NIT"      value={form.nit || 'CF'} />
                  <InfoCell label="Teléfono" value={form.telefono || '—'} />
                  <InfoCell label="Dirección de entrega" value={addrStr || <span style={{ color:'#C62828' }}>Sin dirección</span>} span />
                  {addr?.referencias && <InfoCell label="Referencias" value={addr.referencias} span />}
                </>
              ) : (
                <>
                  <InfoCell label="Cliente"  value={form.nombre || <span style={{ color:'#aaa' }}>—</span>} />
                  <InfoCell label="Empresa"  value={form.empresa || '—'} />
                  <InfoCell label="NIT"      value={form.nit || 'CF'} />
                  <InfoCell label="Teléfono" value={form.telefono || '—'} />
                </>
              )}
            </div>
          </div>

          {/* ── Product table ── */}
          <div style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: G }}>
                  {['Producto', 'Unidad', 'Cant.', 'P. Unitario', 'P. Total', ''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', color: '#F5F0E4', fontSize: '.7rem', fontWeight: 700, textAlign: h === 'P. Unitario' || h === 'P. Total' ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ background: i % 2 ? '#F9F7F2' : '#FDFCF8', borderBottom: '1px solid #F0EBE0' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: '.85rem', color: G }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {item.foto && (
                          <img src={item.foto} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        {item.nombre}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '.82rem', color: '#6B8070' }}>{item.unidad}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {/* Inline qty control */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button onClick={() => setQty(item.id, item.qty - 1)} style={qBtn}>−</button>
                        <span style={{ fontSize: '.9rem', fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                        <button onClick={() => setQty(item.id, item.qty + 1)} style={qBtn}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '.85rem', color: '#333' }}>{fmtQ(item.precio)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '.88rem', color: '#2D6645' }}>{fmtQ(item.precio * item.qty)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '.8rem', padding: '2px 4px', borderRadius: 3, opacity: .7 }} title="Quitar">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Totals block ── */}
          <div style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 8, padding: '16px 20px', marginBottom: 16, maxWidth: 360, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.83rem', color: '#6B8070', marginBottom: 6 }}>
              <span>Subtotal (neto)</span>
              <span>{fmtQ(neto)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.83rem', color: '#6B8070', marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed #E8DCC8' }}>
              <span>IVA (12%)</span>
              <span>{fmtQ(iva)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem', color: G }}>
              <span>Total</span>
              <span>{fmtQ(total)}</span>
            </div>
          </div>

          {/* Under minimum warning */}
          {underMin && (
            <div style={{ padding: '10px 14px', background: '#FFF3E0', border: '1px solid #E65100', borderRadius: 6, fontSize: '.8rem', color: '#E65100', fontWeight: 600, marginBottom: 12 }}>
              ⚠ Mínimo de compra público: {fmtQ(minPublico)}. Falta {fmtQ(minPublico - total)}.
            </div>
          )}

          {!user && (
            <div style={{ padding: '10px 14px', background: '#E8F5E9', border: '1px solid #4A9E6A', borderRadius: 6, fontSize: '.8rem', color: G }}>
              💡 <strong>¿Tenés cuenta?</strong>{' '}
              <Link to="/login" style={{ color: G, fontWeight: 700 }}>Ingresá</Link>{' '}
              para precios negociados y despacho más rápido.
            </div>
          )}
        </div>

        {/* ── RIGHT: Confirmation panel ── */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 8, padding: 20 }}>
            <div style={{ fontWeight: 800, color: G, marginBottom: 16, fontSize: '.9rem' }}>
              {isLoggedIn ? 'Confirmar pedido' : 'Datos para el pedido'}
            </div>

            {isLoggedIn ? (
              /* LOGGED-IN: minimal confirmation */
              <>
                {/* Sucursal selector */}
                {sucursales.length > 0 ? (
                  <label style={{ ...LS, marginBottom: 14 }}>
                    Entregar en
                    <select value={sucursalId} onChange={e => { setSucursalId(e.target.value); setEditAddr(false); }}
                      style={{ ...IS, borderColor: sucursalId !== '__principal__' ? G : '#E8DCC8' }}>
                      <option value="__principal__">📍 Dirección principal</option>
                      {sucursales.map(s => (
                        <option key={s.id} value={s.id}>🏢 {s.nombre}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div style={{ fontSize: '.8rem', color: '#6B8070', marginBottom: 14, padding: '8px 12px', background: '#F5F5F0', borderRadius: 4 }}>
                    📍 Dirección principal
                    {!addr?.direccion && (
                      <div style={{ marginTop: 6, color: '#C62828', fontWeight: 600 }}>
                        ⚠ Sin dirección.{' '}
                        <Link to="/cuenta/perfil" style={{ color: '#C62828' }}>Completar perfil →</Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Address override */}
                {!editAddr ? (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: '.78rem', color: '#6B8070', marginBottom: 4 }}>Dirección de entrega</div>
                    <div style={{ background: '#F5F5F0', borderRadius: 6, padding: '8px 12px', fontSize: '.82rem', color: '#333', lineHeight: 1.5 }}>
                      {addrStr || <span style={{ color:'#C62828' }}>Sin dirección guardada</span>}
                    </div>
                    <button onClick={() => setEditAddr(true)}
                      style={{ marginTop: 6, padding: '4px 10px', background: 'transparent', border: '1px solid #D0C8B4', borderRadius: 4, fontSize: '.73rem', color: '#555', cursor: 'pointer', fontWeight: 600 }}>
                      ✏ Cambiar dirección
                    </button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 14 }}>
                    <AddressForm value={addr} onChange={v => sf('direccion', v)} required />
                    <button onClick={() => setEditAddr(false)}
                      style={{ marginTop: 6, padding: '4px 10px', background: 'transparent', border: '1px solid #D0C8B4', borderRadius: 4, fontSize: '.73rem', color: '#555', cursor: 'pointer' }}>
                      ✓ Usar esta
                    </button>
                  </div>
                )}

                <label style={{ ...LS, marginBottom: 14 }}>
                  Fecha de entrega solicitada *
                  <input type="date" value={form.fechaEntrega} min={today()} onChange={e => sf('fechaEntrega', e.target.value)} style={IS} />
                </label>

                <label style={{ ...LS, marginBottom: 16 }}>
                  Notas adicionales
                  <textarea value={form.notas} onChange={e => sf('notas', e.target.value)} rows={2}
                    style={{ ...IS, resize: 'vertical' }} placeholder="Horario, instrucciones especiales..." />
                </label>

                <div style={{ background: '#F0F7F2', border: '1px solid #B0CCB8', borderRadius: 6, padding: '10px 12px', fontSize: '.75rem', color: G, marginBottom: 14 }}>
                  <strong>ℹ Al confirmar</strong>, tu pedido queda registrado. Te avisamos por email cuando sea aprobado y cuando vaya en ruta.
                </div>

                <Link to="/cuenta/perfil" style={{ display: 'block', textAlign: 'center', fontSize: '.73rem', color: '#4A9E6A', fontWeight: 600, textDecoration: 'none', marginBottom: 12 }}>
                  ✏ Actualizar mis datos →
                </Link>
              </>
            ) : (
              /* GUEST: full form */
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                  <label style={{ ...LS, marginBottom: 12, gridColumn: 'span 2' }}>
                    Nombre / Contacto *
                    <input value={form.nombre} onChange={e => sf('nombre', e.target.value)} style={IS} />
                  </label>
                  <label style={{ ...LS, marginBottom: 12 }}>
                    Empresa
                    <input value={form.empresa} onChange={e => sf('empresa', e.target.value)} style={IS} />
                  </label>
                  <label style={{ ...LS, marginBottom: 12 }}>
                    NIT
                    <input value={form.nit} onChange={e => sf('nit', e.target.value)} style={IS} />
                  </label>
                  <label style={{ ...LS, marginBottom: 12 }}>
                    Teléfono *
                    <input value={form.telefono} onChange={e => sf('telefono', e.target.value)} style={IS} />
                  </label>
                  <label style={{ ...LS, marginBottom: 12 }}>
                    Email
                    <input type="email" value={form.email} onChange={e => sf('email', e.target.value)} style={IS} />
                  </label>
                </div>

                <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#6B8070', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, marginTop: 4 }}>
                  Dirección de entrega
                </div>
                <AddressForm value={form.direccion} onChange={v => sf('direccion', v)} required />

                <label style={{ ...LS, marginBottom: 12, marginTop: 8 }}>
                  Fecha de entrega *
                  <input type="date" value={form.fechaEntrega} min={today()} onChange={e => sf('fechaEntrega', e.target.value)} style={IS} />
                </label>

                <label style={{ ...LS, marginBottom: 16 }}>
                  Notas
                  <textarea value={form.notas} onChange={e => sf('notas', e.target.value)} rows={2}
                    style={{ ...IS, resize: 'vertical' }} placeholder="Horario, instrucciones..." />
                </label>
              </>
            )}

            {/* ── Total summary in confirm panel ── */}
            <div style={{ background: '#F5F5F0', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: '.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B8070', marginBottom: 3 }}>
                <span>Subtotal neto</span><span>{fmtQ(neto)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B8070', marginBottom: 6 }}>
                <span>IVA 12%</span><span>{fmtQ(iva)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '.95rem', color: G }}>
                <span>Total</span><span>{fmtQ(total)}</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving || underMin}
              style={{ width: '100%', padding: '13px', background: (saving || underMin) ? '#ccc' : G, color: '#F5F0E4', border: 'none', borderRadius: 4, fontWeight: 800, fontSize: '.9rem', cursor: (saving || underMin) ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Enviando...' : isLoggedIn ? '✓ Confirmar Orden de Compra' : 'Enviar pedido →'}
            </button>

            <div style={{ marginTop: 10, fontSize: '.72rem', color: '#aaa', textAlign: 'center' }}>
              📋 Pago se coordina al confirmar
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function InfoCell({ label, value, span }) {
  return (
    <div style={{ gridColumn: span ? 'span 2' : undefined }}>
      <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6B8070' }}>{label}</div>
      <div style={{ fontSize: '.82rem', color: '#1A1A18', marginTop: 1 }}>{value}</div>
    </div>
  );
}

const qBtn = {
  width: 24, height: 24, borderRadius: 4, border: '1px solid #E8DCC8',
  background: '#F0EDE6', cursor: 'pointer', fontSize: '.88rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
};
