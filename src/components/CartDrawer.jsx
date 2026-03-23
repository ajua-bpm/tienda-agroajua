import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import { fmtQ } from '../utils/format.js';

const G = '#1A3D28';
const IVA_RATE = 0.12;

export default function CartDrawer({ open, onClose }) {
  const { items, setQty, remove, total, isEmpty } = useCart();
  const navigate = useNavigate();

  const goCheckout = () => { onClose(); navigate('/checkout'); };

  const neto = total / (1 + IVA_RATE);
  const iva  = total - neto;

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 498 }} />}
      <div style={{
        position: 'fixed', top: 0, right: open ? 0 : '-440px', width: '100%', maxWidth: 420,
        height: '100%', background: '#FDFCF8', zIndex: 499,
        transition: 'right .28s ease', boxShadow: '-8px 0 32px rgba(0,0,0,.2)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ background: G, color: '#F5F0E4', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>🛒 Orden de Compra</span>
            <div style={{ fontSize: '.7rem', opacity: .65, marginTop: 2 }}>{items.reduce((s, i) => s + i.qty, 0)} artículos</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#F5F0E4', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {isEmpty ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B8070' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🛒</div>
              Tu carrito está vacío
            </div>
          ) : items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #E8DCC8' }}>
              <div style={{ width: 44, height: 44, borderRadius: 6, background: '#E8DCC8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0, overflow: 'hidden' }}>
                {item.foto ? <img src={item.foto} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🌿'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '.83rem', color: G, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre}</div>
                <div style={{ fontSize: '.72rem', color: '#6B8070' }}>{fmtQ(item.precio)} / {item.unidad}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <button onClick={() => setQty(item.id, item.qty - 1)} style={qBtn}>−</button>
                <span style={{ fontSize: '.88rem', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                <button onClick={() => setQty(item.id, item.qty + 1)} style={qBtn}>+</button>
              </div>
              <div style={{ fontWeight: 700, fontSize: '.83rem', color: '#2D6645', minWidth: 62, textAlign: 'right' }}>
                {fmtQ(item.precio * item.qty)}
              </div>
              <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '.8rem', padding: 2 }}>✕</button>
            </div>
          ))}
        </div>

        {/* Footer — tax breakdown */}
        {!isEmpty && (
          <div style={{ padding: '14px 20px', borderTop: '2px solid #E8DCC8', background: '#fff' }}>
            <div style={{ fontSize: '.8rem', color: '#6B8070', marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span>Subtotal (neto)</span>
                <span>{fmtQ(neto)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>IVA (12%)</span>
                <span>{fmtQ(iva)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', marginBottom: 12, paddingTop: 8, borderTop: '1px dashed #E8DCC8' }}>
              <span>Total</span>
              <span style={{ color: G }}>{fmtQ(total)}</span>
            </div>
            <button onClick={goCheckout} style={{ width: '100%', padding: '13px', background: G, color: '#F5F0E4', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '.88rem', cursor: 'pointer' }}>
              Ver Orden de Compra →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const qBtn = {
  width: 24, height: 24, borderRadius: 4, border: '1px solid #E8DCC8',
  background: '#F9F6EF', cursor: 'pointer', fontSize: '.88rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
};
