import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';
import CartDrawer from './CartDrawer.jsx';

const G = '#1A3D28';

export default function Navbar() {
  const { user, cliente, logout, isAdmin } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <nav style={{
        background: G, color: '#F5F0E4', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 28px', height: 58,
        position: 'sticky', top: 0, zIndex: 200,
        boxShadow: '0 2px 12px rgba(0,0,0,.25)',
      }}>
        <Link to="/" style={{ fontWeight: 900, fontSize: '1.15rem', color: '#F5F0E4', textDecoration: 'none', letterSpacing: '-.01em' }}>
          🌿 AJÚA Tienda
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin() && (
            <Link to="/admin" style={{ fontSize: '.78rem', fontWeight: 700, color: '#8DC26F', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(141,194,111,.4)', borderRadius: 4 }}>
              Admin
            </Link>
          )}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{ background: 'rgba(255,255,255,.1)', border: '1.5px solid rgba(255,255,255,.2)', color: '#F5F0E4', padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}
              >
                👤 {cliente?.nombre?.split(' ')[0] || 'Mi cuenta'} ▾
              </button>
              {menuOpen && (
                <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.15)', minWidth: 160, overflow: 'hidden', zIndex: 300 }}>
                  <Link to="/cuenta" onClick={() => setMenuOpen(false)} style={menuItem}>Mi cuenta</Link>
                  <Link to="/cuenta/ordenes" onClick={() => setMenuOpen(false)} style={menuItem}>Mis pedidos</Link>
                  <button onClick={handleLogout} style={{ ...menuItem, width: '100%', textAlign: 'left', color: '#C62828', borderTop: '1px solid #F0F0F0' }}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" style={{ background: 'transparent', border: '1.5px solid rgba(245,240,228,.4)', color: '#F5F0E4', padding: '7px 16px', borderRadius: 4, textDecoration: 'none', fontSize: '.8rem', fontWeight: 500 }}>
              Ingresar
            </Link>
          )}
          <button
            onClick={() => setCartOpen(true)}
            style={{ position: 'relative', background: '#4A9E6A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '.8rem' }}
          >
            🛒 Carrito
            {count > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, background: '#e67e22', color: '#fff', borderRadius: '50%', fontSize: '.58rem', fontWeight: 800, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {count}
              </span>
            )}
          </button>
        </div>
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />}
    </>
  );
}

const menuItem = {
  display: 'block', padding: '10px 16px', fontSize: '.83rem', color: '#1A1A18',
  textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none',
  fontFamily: 'inherit', width: '100%',
};
