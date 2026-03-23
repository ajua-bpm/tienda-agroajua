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

const G  = '#1A3D28';
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#6B8070' };
const IS = { padding:'10px 12px', border:'1.5px solid #E8DCC8', borderRadius:4, fontSize:'.88rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

// Format a structured address object into a readable string
function fmtAddr(dir) {
  if (!dir) return '—';
  if (typeof dir === 'string') return dir;
  return [dir.direccion, dir.zona, dir.municipio, dir.departamento, dir.pais].filter(Boolean).join(', ');
}

export default function Checkout() {
  const { items, total, clear, isEmpty } = useCart();
  const { user, cliente, tier }          = useAuth();
  const toast   = useToast();
  const navigate = useNavigate();

  const [config, setConfig]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [editAddr, setEditAddr] = useState(false);  // whether to show address form for logged-in user

  // For logged-in users: sucursal selection
  const sucursales = cliente?.sucursales || [];
  const [sucursalId, setSucursalId] = useState('__principal__');  // '__principal__' = main address

  // Form — used for guests + for overriding when editing address
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

  // Pre-fill from client profile when logged in
  useEffect(() => {
    if (!cliente) return;
    setForm(f => ({
      ...f,
      nombre:   cliente.nombre   || '',
      empresa:  cliente.empresa  || '',
      nit:      cliente.nit      || 'CF',
      telefono: cliente.telefono || '',
      email:    cliente.email    || user?.email || '',
      direccion: cliente.direccion || f.direccion,
    }));
  }, [cliente, user]);

  // When sucursal selection changes, update the address in form
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

  // Resolve which address to use
  const resolvedAddress = () => {
    if (sucursalId !== '__principal__') {
      const suc = sucursales.find(s => s.id === sucursalId);
      return suc?.direccion || form.direccion;
    }
    return form.direccion;
  };

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
        // Client info
        clienteUid:   user?.uid  || null,
        clienteId:    user?.uid  || null,
        clienteTier:  t,
        nombre:       form.nombre,
        empresa:      form.empresa,
        nit:          form.nit,
        telefono:     form.telefono,
        email:        form.email,
        // Address
        direccion:    addr,
        direccionStr: fmtAddr(addr),
        sucursalId:   sucursalId !== '__principal__' ? sucursalId : null,
        sucursalNombre: sucursal?.nombre || null,
        notas:        form.notas,
        // Items
        items: items.map(i => ({
          productoId: i.id,
          nombre:     i.nombre,
          unidad:     i.unidad,
          precio:     i.precio,
          cantidad:   i.qty,
          subtotal:   i.precio * i.qty,
        })),
        total,
        // Payment / Invoice / Delivery — structure ready
        pago:     { estado: 'pendiente', metodo: null, pagos: [] },
        factura:  { estado: 'pendiente', correlativo: null, uuid: null, xmlUrl: null },
        entrega:  { estado: 'pendiente', transportista: null, rutaId: null, fechaReal: null, firmaUrl: null },
        creadoEn: serverTimestamp(),
      };

      await addDoc(collection(db, 't_ordenes'), orden);
      clear();
      notifyNuevoPedido(orden);   // non-blocking
      toast(`✓ Pedido ${correlativo} enviado`);
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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: G, marginBottom: 24 }}>Confirmar pedido</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Left — delivery + notes */}
        <div>

          {/* Logged-in: show saved info, allow picking sucursal */}
          {isLoggedIn ? (
            <>
              <Section title="Datos del cliente">
                <InfoRow label="Nombre"   value={form.nombre} />
                <InfoRow label="Empresa"  value={form.empresa || '—'} />
                <InfoRow label="Teléfono" value={form.telefono || '—'} />
                <InfoRow label="Email"    value={form.email || '—'} />
                <InfoRow label="NIT"      value={form.nit || 'CF'} />
                <Link to="/cuenta/perfil" style={{ fontSize:'.75rem', color:'#4A9E6A', fontWeight:600, textDecoration:'none' }}>
                  ✏ Actualizar mis datos →
                </Link>
              </Section>

              <Section title="Dirección de entrega">
                {/* Sucursal selector — only if they have sucursales */}
                {sucursales.length > 0 && (
                  <label style={{ ...LS, marginBottom:14 }}>
                    Entregar en
                    <select value={sucursalId} onChange={e => { setSucursalId(e.target.value); setEditAddr(false); }}
                      style={{ ...IS, borderColor: sucursalId !== '__principal__' ? G : '#E8DCC8' }}>
                      <option value="__principal__">📍 Dirección principal</option>
                      {sucursales.map(s => (
                        <option key={s.id} value={s.id}>🏢 {s.nombre}</option>
                      ))}
                    </select>
                  </label>
                )}

                {!editAddr ? (
                  <div>
                    <div style={{ background:'#F5F5F0', borderRadius:6, padding:'10px 14px', fontSize:'.85rem', color:'#333', lineHeight:1.6 }}>
                      {addrStr || <span style={{ color:'#C62828' }}>Sin dirección guardada</span>}
                      {addr?.referencias && <div style={{ fontSize:'.78rem', color:'#888', marginTop:4 }}>Ref: {addr.referencias}</div>}
                    </div>
                    <button onClick={() => setEditAddr(true)}
                      style={{ marginTop:8, padding:'5px 12px', background:'transparent', border:'1px solid #D0C8B4', borderRadius:4, fontSize:'.75rem', color:'#555', cursor:'pointer', fontWeight:600 }}>
                      ✏ Cambiar dirección
                    </button>
                    {!addr?.direccion && (
                      <div style={{ marginTop:8, fontSize:'.8rem', color:'#C62828', fontWeight:600 }}>
                        ⚠ Guardá tu dirección en{' '}
                        <Link to="/cuenta/perfil" style={{ color:'#C62828' }}>Mi perfil</Link> antes de confirmar.
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <AddressForm value={addr} onChange={v => sf('direccion', v)} required />
                    <button onClick={() => setEditAddr(false)}
                      style={{ marginTop:6, padding:'5px 12px', background:'transparent', border:'1px solid #D0C8B4', borderRadius:4, fontSize:'.75rem', color:'#555', cursor:'pointer' }}>
                      ✓ Usar esta dirección
                    </button>
                  </div>
                )}
              </Section>
            </>
          ) : (
            /* Guest — full form */
            <>
              <Section title="Datos del cliente">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={LS}>Nombre / Contacto *<input value={form.nombre} onChange={e => sf('nombre', e.target.value)} style={IS} /></label>
                  <label style={LS}>Empresa<input value={form.empresa} onChange={e => sf('empresa', e.target.value)} style={IS} /></label>
                  <label style={LS}>NIT<input value={form.nit} onChange={e => sf('nit', e.target.value)} style={IS} /></label>
                  <label style={LS}>Teléfono / WhatsApp *<input value={form.telefono} onChange={e => sf('telefono', e.target.value)} style={IS} /></label>
                  <label style={{ ...LS, gridColumn: 'span 2' }}>Email<input type="email" value={form.email} onChange={e => sf('email', e.target.value)} style={IS} /></label>
                </div>
              </Section>
              <Section title="Dirección de entrega">
                <AddressForm value={form.direccion} onChange={v => sf('direccion', v)} required />
              </Section>
            </>
          )}

          <Section title="Entrega">
            <label style={LS}>
              Fecha solicitada *
              <input type="date" value={form.fechaEntrega} min={today()} onChange={e => sf('fechaEntrega', e.target.value)} style={IS} />
            </label>
            <label style={{ ...LS, marginTop:12 }}>
              Notas adicionales
              <textarea value={form.notas} onChange={e => sf('notas', e.target.value)} rows={2}
                style={{ ...IS, resize:'vertical' }} placeholder="Horario, acceso, temperatura..." />
            </label>
          </Section>
        </div>

        {/* Right — order summary */}
        <div>
          <Section title="Resumen del pedido">
            {items.map(item => (
              <div key={item.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #F0EBE0', fontSize:'.85rem' }}>
                <div>
                  <span style={{ fontWeight:600 }}>{item.nombre}</span>
                  <span style={{ color:'#6B8070', marginLeft:8 }}>× {item.qty} {item.unidad}</span>
                </div>
                <span style={{ fontWeight:700, color:'#2D6645' }}>{fmtQ(item.precio * item.qty)}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:'1rem', marginTop:12, paddingTop:12, borderTop:'2px solid #E8DCC8' }}>
              <span>Total</span>
              <span style={{ color:G }}>{fmtQ(total)}</span>
            </div>

            {underMin && (
              <div style={{ marginTop:12, padding:'10px 14px', background:'#FFF3E0', border:'1px solid #E65100', borderRadius:4, fontSize:'.8rem', color:'#E65100', fontWeight:600 }}>
                ⚠ Mínimo de compra público: {fmtQ(minPublico)}. Falta {fmtQ(minPublico - total)}.
              </div>
            )}

            {!user && (
              <div style={{ marginTop:12, padding:'10px 14px', background:'#E8F5E9', border:'1px solid #4A9E6A', borderRadius:4, fontSize:'.8rem', color:G }}>
                💡 <strong>¿Tenés cuenta?</strong>{' '}
                <Link to="/login" style={{ color:G, fontWeight:700 }}>Ingresá</Link>{' '}
                para usar tu dirección guardada y precios negociados.
              </div>
            )}
          </Section>

          <Section title="Pago">
            <div style={{ background:'#F5F5F5', borderRadius:4, padding:'12px 14px', fontSize:'.82rem', color:'#555' }}>
              📋 El método de pago se coordina al confirmar el pedido (transferencia, efectivo u otro método acordado).
            </div>
          </Section>

          {/* Confirmation note for logged-in */}
          {isLoggedIn && (
            <div style={{ background:'#F0F7F2', border:'1px solid #B0CCB8', borderRadius:6, padding:'12px 14px', fontSize:'.8rem', color:G, marginBottom:12 }}>
              <strong>ℹ Tu pedido quedará pendiente de confirmación.</strong><br/>
              Te avisaremos por email cuando sea confirmado, cuando vaya en ruta y cuando sea entregado.
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || underMin}
            style={{ width:'100%', padding:'14px', background:(saving || underMin) ? '#ccc' : G, color:'#F5F0E4', border:'none', borderRadius:4, fontWeight:800, fontSize:'.92rem', cursor:(saving || underMin) ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Enviando pedido...' : isLoggedIn ? '✓ Confirmar pedido →' : 'Enviar pedido →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background:'#FDFCF8', border:'1px solid #E8DCC8', borderRadius:8, padding:18, marginBottom:16 }}>
      <div style={{ fontWeight:700, fontSize:'.78rem', textTransform:'uppercase', letterSpacing:'.07em', color:G, marginBottom:14, paddingBottom:10, borderBottom:'1px solid #F0EBE0' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:6, fontSize:'.83rem' }}>
      <span style={{ fontWeight:700, color:'#888', minWidth:80, flexShrink:0 }}>{label}</span>
      <span style={{ color:'#1A1A18' }}>{value}</span>
    </div>
  );
}
