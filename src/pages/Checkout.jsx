import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { db, doc, getDoc, addDoc, collection, serverTimestamp } from '../firebase.js';
import { nextCorrelativo } from '../utils/correlativo.js';
import { checkMinimo } from '../utils/precios.js';
import { fmtQ, today } from '../utils/format.js';

const G = '#1A3D28';
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#6B8070' };
const IS = { padding:'10px 12px', border:'1.5px solid #E8DCC8', borderRadius:4, fontSize:'.88rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

export default function Checkout() {
  const { items, total, clear, isEmpty } = useCart();
  const { user, cliente, tier } = useAuth();
  const toast   = useToast();
  const navigate = useNavigate();

  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre:    '',
    empresa:   '',
    nit:       'CF',
    telefono:  '',
    email:     '',
    direccion: '',
    fechaEntrega: '',
    notas:     '',
  });

  useEffect(() => {
    getDoc(doc(db, 't_config', 'tienda')).then(s => setConfig(s.exists() ? s.data() : {}));
    if (cliente) {
      setForm(f => ({
        ...f,
        nombre:   cliente.nombre || '',
        empresa:  cliente.empresa || '',
        nit:      cliente.nit || 'CF',
        telefono: cliente.telefono || '',
        email:    cliente.email || user?.email || '',
      }));
    }
  }, [cliente, user]);

  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nombre || !form.telefono || !form.direccion) {
      toast('Nombre, teléfono y dirección son requeridos', 'error'); return;
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
      const orden = {
        correlativo,
        estado:       'nueva',
        fecha:        today(),
        fechaEntrega: form.fechaEntrega,
        // Client info
        clienteUid:   user?.uid || null,
        clienteId:    user?.uid || null,
        clienteTier:  t,
        nombre:       form.nombre,
        empresa:      form.empresa,
        nit:          form.nit,
        telefono:     form.telefono,
        email:        form.email,
        direccion:    form.direccion,
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
        // Payment / Invoice — structure ready
        pago:     { estado: 'pendiente', metodo: null, pagos: [] },
        factura:  { estado: 'pendiente', correlativo: null, uuid: null, xmlUrl: null },
        entrega:  { estado: 'pendiente', transportista: null, rutaId: null, fechaReal: null, firmaUrl: null },
        creadoEn: serverTimestamp(),
      };

      await addDoc(collection(db, 't_ordenes'), orden);
      clear();
      toast(`✓ Pedido ${correlativo} enviado correctamente`);
      navigate(`/cuenta/ordenes`);
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
  const underMin = !user && total < minPublico;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: G, marginBottom: 24 }}>Completar pedido</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Left — form */}
        <div>
          <Section title="Datos del cliente">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={LS}>Nombre / Contacto *<input value={form.nombre} onChange={e => s('nombre', e.target.value)} style={IS} /></label>
              <label style={LS}>Empresa<input value={form.empresa} onChange={e => s('empresa', e.target.value)} style={IS} /></label>
              <label style={LS}>NIT<input value={form.nit} onChange={e => s('nit', e.target.value)} style={IS} /></label>
              <label style={LS}>Teléfono / WhatsApp *<input value={form.telefono} onChange={e => s('telefono', e.target.value)} style={IS} /></label>
              <label style={{ ...LS, gridColumn: 'span 2' }}>Email<input type="email" value={form.email} onChange={e => s('email', e.target.value)} style={IS} /></label>
            </div>
          </Section>

          <Section title="Entrega">
            <label style={LS}>Dirección de entrega *<textarea value={form.direccion} onChange={e => s('direccion', e.target.value)} rows={2} style={{ ...IS, resize: 'vertical' }} /></label>
            <label style={{ ...LS, marginTop: 12 }}>Fecha de entrega solicitada *<input type="date" value={form.fechaEntrega} min={today()} onChange={e => s('fechaEntrega', e.target.value)} style={IS} /></label>
            <label style={{ ...LS, marginTop: 12 }}>Notas adicionales<textarea value={form.notas} onChange={e => s('notas', e.target.value)} rows={2} style={{ ...IS, resize: 'vertical' }} placeholder="Horario, acceso, temperatura requerida..." /></label>
          </Section>
        </div>

        {/* Right — order summary */}
        <div>
          <Section title="Resumen del pedido">
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F0EBE0', fontSize: '.85rem' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{item.nombre}</span>
                  <span style={{ color: '#6B8070', marginLeft: 8 }}>× {item.qty} {item.unidad}</span>
                </div>
                <span style={{ fontWeight: 700, color: '#2D6645' }}>{fmtQ(item.precio * item.qty)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', marginTop: 12, paddingTop: 12, borderTop: '2px solid #E8DCC8' }}>
              <span>Total</span>
              <span style={{ color: G }}>{fmtQ(total)}</span>
            </div>

            {underMin && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#FFF3E0', border: '1px solid #E65100', borderRadius: 4, fontSize: '.8rem', color: '#E65100', fontWeight: 600 }}>
                ⚠ Mínimo de compra público: {fmtQ(minPublico)}. Falta {fmtQ(minPublico - total)}.
              </div>
            )}

            {!user && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#E8F5E9', border: '1px solid #4A9E6A', borderRadius: 4, fontSize: '.8rem', color: G }}>
                💡 <strong>¿Tenés cuenta?</strong> Ingresá para ver tus precios negociados.
              </div>
            )}
          </Section>

          <Section title="Pago">
            <div style={{ fontSize: '.82rem', color: '#6B8070', marginBottom: 8 }}>Método de pago</div>
            <div style={{ background: '#F5F5F5', borderRadius: 4, padding: '12px 14px', fontSize: '.82rem', color: '#555' }}>
              📋 Se coordinará el pago al confirmar el pedido (transferencia bancaria, efectivo u otro método acordado).
            </div>
          </Section>

          <button
            onClick={handleSubmit}
            disabled={saving || underMin}
            style={{ width: '100%', padding: '14px', background: (saving || underMin) ? '#ccc' : G, color: '#F5F0E4', border: 'none', borderRadius: 4, fontWeight: 800, fontSize: '.92rem', cursor: (saving || underMin) ? 'not-allowed' : 'pointer', marginTop: 4 }}
          >
            {saving ? 'Enviando pedido...' : 'Enviar pedido →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 8, padding: 18, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.07em', color: G, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #F0EBE0' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
