import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const G = '#1A3D28';

const LINKS = [
  { to: '/admin',               label: 'Dashboard',        end: true },
  { to: '/admin/ordenes',       label: 'Órdenes' },
  { to: '/admin/calendario',    label: 'Calendario' },
  { to: '/admin/clientes',      label: 'Clientes' },
  { to: '/admin/productos',     label: 'Productos' },
  { to: '/admin/listas',        label: 'Listas de precio' },
  { to: '/admin/facturacion',   label: 'Facturación' },
  { to: '/admin/pagos',         label: 'Pagos' },
  { to: '/admin/entregas',      label: 'Entregas' },
  { to: '/admin/promociones',   label: 'Promociones' },
  { to: '/admin/importar',      label: 'Carga masiva' },
  { to: '/admin/config',        label: 'Configuración' },
];

const linkStyle = active => ({
  display: 'block', padding: '8px 14px', textDecoration: 'none',
  fontWeight: 600, fontSize: '.8rem', borderRadius: 6,
  background: active ? 'rgba(255,255,255,.14)' : 'transparent',
  color: active ? '#fff' : 'rgba(245,240,228,.65)',
  transition: 'all .12s',
});

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin()) return <Navigate to="/" replace />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: 200, background: G, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ color: '#F5F0E4', fontWeight: 900, fontSize: '.92rem' }}>AJÚA Admin</div>
          <div style={{ color: 'rgba(245,240,228,.45)', fontSize: '.68rem', marginTop: 2 }}>Portal B2B</div>
        </div>
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} style={({ isActive }) => linkStyle(isActive)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.1)', fontSize: '.68rem', color: 'rgba(245,240,228,.35)' }}>
          tienda.agroajua.com
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, background: '#F5F5F0', overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px', maxWidth: 1300 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
