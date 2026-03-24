import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

const G = '#1B5E20';
const W = 220;

const NAV = [
  { to: '/cuenta',            end: true,  icon: '🏠', label: 'Mi Resumen'    },
  { to: '/cuenta/pedidos',    end: false, icon: '📦', label: 'Mis Pedidos'   },
  { to: '/cuenta/facturas',   end: false, icon: '🧾', label: 'Mis Facturas'  },
  { to: '/cuenta/pagos',      end: false, icon: '💰', label: 'Mis Pagos'     },
  { to: '/cuenta/calendario', end: false, icon: '📅', label: 'Mi Calendario' },
  { to: '/cuenta/perfil',     end: false, icon: '👤', label: 'Mi Perfil'     },
];

const linkStyle = active => ({
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '11px 20px',
  textDecoration: 'none',
  fontSize: '.85rem', fontWeight: active ? 700 : 500,
  background: active ? 'rgba(255,255,255,.14)' : 'transparent',
  color: active ? '#fff' : 'rgba(255,255,255,.62)',
  borderLeft: active ? '3px solid #8DC26F' : '3px solid transparent',
  transition: 'all .12s',
});

const btnLinkStyle = (active) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
  gap: 3, flex: 1, padding: '8px 4px',
  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: '.62rem', fontWeight: active ? 700 : 500,
  color: active ? '#8DC26F' : 'rgba(255,255,255,.55)',
});

export default function CuentaLayout() {
  const { cliente, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F3EF' }}>

      {/* ── Sidebar — desktop ── */}
      <aside style={{
        width: W, flexShrink: 0, background: G,
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}
        className="cuenta-sidebar"
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontSize: '.65rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>
            🌿 AGROINDUSTRIA AJÚA
          </div>
          <div style={{ fontWeight: 800, fontSize: '.95rem', color: '#fff', lineHeight: 1.25 }}>
            {cliente?.nombre || 'Mi Cuenta'}
          </div>
          {cliente?.empresa && (
            <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
              {cliente.empresa}
            </div>
          )}
          {cliente?.codigo && (
            <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.3)', marginTop: 3 }}>
              {cliente.codigo}
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => linkStyle(isActive)}
            >
              <span style={{ fontSize: '1.05rem' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <button onClick={() => navigate('/')}
            style={{ width: '100%', padding: '9px', background: '#4A9E6A', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', marginBottom: 8 }}>
            🛒 Hacer pedido
          </button>
          <button onClick={handleLogout}
            style={{ width: '100%', padding: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,.2)', color: 'rgba(255,255,255,.6)', borderRadius: 4, fontWeight: 600, fontSize: '.75rem', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, minWidth: 0, paddingBottom: 72 }}>
        <Outlet />
      </main>

      {/* ── Bottom nav — mobile ── */}
      <nav style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
        background: G, borderTop: '1px solid rgba(255,255,255,.12)',
        zIndex: 200,
      }}
        className="cuenta-bottom-nav"
      >
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            style={{ textDecoration: 'none', flex: 1, display: 'flex' }}
          >
            {({ isActive }) => (
              <button style={btnLinkStyle(isActive)}>
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                {item.label.split(' ')[1] || item.label}
              </button>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .cuenta-sidebar     { display: none !important; }
          .cuenta-bottom-nav  { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
