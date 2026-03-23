import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const G = '#1A3D28', L = '#2D6645';

const LINKS = [
  { to: '/admin',          label: '📊 Dashboard',     end: true },
  { to: '/admin/ordenes',  label: '📋 Órdenes' },
  { to: '/admin/productos',label: '🌿 Productos' },
  { to: '/admin/clientes', label: '👥 Clientes' },
  { to: '/admin/entregas', label: '🚚 Entregas' },
  { to: '/admin/facturacion', label: '🧾 Facturación' },
  { to: '/admin/pagos',    label: '💰 Pagos' },
  { to: '/admin/listas',   label: '💲 Listas de Precio' },
  { to: '/admin/config',   label: '⚙️ Configuración' },
];

const linkStyle = active => ({
  display: 'block', padding: '9px 16px', textDecoration: 'none',
  fontWeight: 600, fontSize: '.8rem', borderRadius: 6,
  background: active ? 'rgba(255,255,255,.12)' : 'transparent',
  color: active ? '#fff' : 'rgba(245,240,228,.7)',
  transition: 'all .12s',
});

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin()) return <Navigate to="/" replace />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: 210, background: G, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ color: '#F5F0E4', fontWeight: 900, fontSize: '.95rem' }}>🌿 AJÚA Admin</div>
          <div style={{ color: 'rgba(245,240,228,.5)', fontSize: '.7rem', marginTop: 2 }}>Tienda en línea</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} style={({ isActive }) => linkStyle(isActive)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.1)', fontSize: '.7rem', color: 'rgba(245,240,228,.4)' }}>
          tienda.agroajua.com
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, background: '#F5F5F0', overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
