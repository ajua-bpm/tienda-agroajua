import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';

// Public pages
import Catalogo  from './pages/Catalogo.jsx';
import Checkout  from './pages/Checkout.jsx';
import Login     from './pages/Login.jsx';
import Registro  from './pages/Registro.jsx';

// Customer account
import MiCuenta    from './pages/cuenta/MiCuenta.jsx';
import MisOrdenes  from './pages/cuenta/MisOrdenes.jsx';

// Admin
import AdminLayout      from './admin/AdminLayout.jsx';
import Dashboard        from './admin/Dashboard.jsx';
import AdminOrdenes     from './admin/AdminOrdenes.jsx';
import AdminProductos   from './admin/AdminProductos.jsx';
import AdminClientes    from './admin/AdminClientes.jsx';
import AdminEntregas    from './admin/AdminEntregas.jsx';
import AdminFacturacion from './admin/AdminFacturacion.jsx';
import AdminPagos       from './admin/AdminPagos.jsx';
import AdminListas      from './admin/AdminListas.jsx';
import AdminConfig      from './admin/AdminConfig.jsx';
import AdminImport      from './admin/AdminImport.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: window.location.pathname }} replace />;
  return children;
}

function PublicLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      <footer style={{ background: '#1A3D28', color: 'rgba(245,240,228,.6)', textAlign: 'center', padding: '16px 24px', fontSize: '.75rem' }}>
        © {new Date().getFullYear()} Agroindustria AJÚA · Guatemala · agroajua@gmail.com
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public store */}
      <Route path="/" element={<PublicLayout><Catalogo /></PublicLayout>} />
      <Route path="/checkout" element={<PublicLayout><Checkout /></PublicLayout>} />
      <Route path="/login"    element={<PublicLayout><Login /></PublicLayout>} />
      <Route path="/registro" element={<PublicLayout><Registro /></PublicLayout>} />

      {/* Customer account (requires auth) */}
      <Route path="/cuenta" element={<RequireAuth><PublicLayout><MiCuenta /></PublicLayout></RequireAuth>}>
        <Route index       element={<MisOrdenes />} />
        <Route path="ordenes" element={<MisOrdenes />} />
      </Route>

      {/* Admin panel (requires admin role — checked inside AdminLayout) */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index            element={<Dashboard />} />
        <Route path="ordenes"   element={<AdminOrdenes />} />
        <Route path="productos" element={<AdminProductos />} />
        <Route path="clientes"  element={<AdminClientes />} />
        <Route path="entregas"  element={<AdminEntregas />} />
        <Route path="facturacion" element={<AdminFacturacion />} />
        <Route path="pagos"     element={<AdminPagos />} />
        <Route path="listas"    element={<AdminListas />} />
        <Route path="importar"  element={<AdminImport />} />
        <Route path="config"    element={<AdminConfig />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
