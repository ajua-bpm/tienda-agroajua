import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import { fmtQ } from '../utils/format.js';

const G = '#1A3D28';

export default function CartDrawer({ open, onClose }) {
  const { items, setQty, remove, total, isEmpty } = useCart();
  const navigate = useNavigate();

  const goCheckout = () => { onClose(); navigate('/checkout'); };

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
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>🛒 Tu carrito</span>
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
              <div style={{ width: 48, height: 48, borderRadius: 6, background: '#E8DCC8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0, overflow: 'hidden' }}>
                {item.foto ? <img src={item.foto} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🌿'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '.85rem', color: G, marginBottom: 2 }}>{item.nombre}</div>
                <div style={{ fontSize: '.75rem', color: '#6B8070' }}>{fmtQ(item.precio)} / {item.unidad}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setQty(item.id, item.qty - 1)} style={qBtn}>−</button>
                <span style={{ fontSize: '.9rem', fontWeight: 700, minWidth: 22, textAlign: 'center' }}>{item.qty}</span>
                <button onClick={() => setQty(item.id, item.qty + 1)} style={qBtn}>+</button>
              </div>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#2D6645', minWidth: 64, textAlign: 'right' }}>
                {fmtQ(item.precio * item.qty)}
              </div>
              <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '.8rem', padding: 2 }}>✕</button>
            </div>
          ))}
        </div>

        {/* Footer */}
        {!isEmpty && (
          <div style={{ padding: '16px 20px', borderTop: '2px solid #E8DCC8', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', marginBottom: 14 }}>
              <span>Total estimado</span>
              <span style={{ color: G }}>{fmtQ(total)}</span>
            </div>
            <button onClick={goCheckout} style={{ width: '100%', padding: '13px', background: G, color: '#F5F0E4', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '.88rem', cursor: 'pointer' }}>
              Completar pedido →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const qBtn = {
  width: 26, height: 26, borderRadius: 4, border: '1px solid #E8DCC8',
  background: '#F9F6EF', cursor: 'pointer', fontSize: '.95rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
};
