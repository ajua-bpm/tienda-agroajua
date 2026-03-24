import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

const G = '#1B5E20';

export default function MiCuenta() {
  const { cliente, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const nombre  = cliente?.nombre  || 'Mi Cuenta';
  const empresa = cliente?.empresa || '';
  const codigo  = cliente?.codigo  || '';

  const path      = location.pathname.replace(/\/$/, '');
  const isResumen = path === '/cuenta';
  const isOrdenes = path.startsWith('/cuenta/ordenes');
  const isPerfil  = path.startsWith('/cuenta/perfil');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const TABS = [
    { to: '/cuenta',          label: 'Resumen',     active: isResumen },
    { to: '/cuenta/ordenes',  label: 'Mis Pedidos', active: isOrdenes },
    { to: '/cuenta/perfil',   label: 'Mi Perfil',   active: isPerfil  },
  ];

  return (
    <div style={{ maxWidth:800, margin:'0 auto', paddingBottom:60 }}>

      {/* ══ HEADER ═════════════════════════════════════════════════════════ */}
      <div style={{ background:G, color:'#F5F0E4', borderRadius:'0 0 12px 12px', marginBottom:4, boxShadow:'0 4px 16px rgba(0,0,0,.18)' }}>

        {/* Banda superior — marca + logout */}
        <div style={{ padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontSize:'.7rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(245,240,228,.5)', fontWeight:700 }}>
            🌿 AGROINDUSTRIA AJÚA — Mi Cuenta
          </div>
          <button
            onClick={handleLogout}
            style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', color:'rgba(245,240,228,.75)', padding:'5px 12px', borderRadius:4, fontSize:'.72rem', cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>
            Cerrar sesión
          </button>
        </div>

        {/* Nombre cliente + CTA */}
        <div style={{ padding:'16px 20px 20px', display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:'1.35rem', fontWeight:900, letterSpacing:'-.01em', lineHeight:1.2 }}>{nombre}</div>
            {empresa && <div style={{ fontSize:'.85rem', color:'rgba(245,240,228,.65)', marginTop:2 }}>{empresa}</div>}
            <div style={{ fontSize:'.72rem', color:'rgba(245,240,228,.4)', marginTop:3, display:'flex', gap:12, flexWrap:'wrap' }}>
              {codigo && <span>{codigo}</span>}
              {cliente?.diasCredito > 0
                ? <span>{cliente.diasCredito} días de crédito</span>
                : <span>Pago al contado</span>
              }
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{ minHeight:48, padding:'12px 22px', background:'#4A9E6A', color:'#fff', border:'none', borderRadius:8, fontWeight:800, fontSize:'.9rem', cursor:'pointer', letterSpacing:'.02em', whiteSpace:'nowrap', flexShrink:0 }}>
            + Nuevo Pedido
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,.1)', overflowX:'auto' }}>
          {TABS.map(tab => (
            <button key={tab.to}
              onClick={() => navigate(tab.to)}
              style={{
                padding:'12px 22px', border:'none', cursor:'pointer', fontFamily:'inherit',
                fontSize:'.82rem', fontWeight:700, letterSpacing:'.02em', whiteSpace:'nowrap',
                background:'transparent',
                color: tab.active ? '#fff' : 'rgba(245,240,228,.4)',
                borderBottom: tab.active ? '3px solid #8DC26F' : '3px solid transparent',
                transition:'color .15s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ CONTENIDO ══════════════════════════════════════════════════════ */}
      <div style={{ padding:'20px 16px' }}>
        <Outlet />
      </div>
    </div>
  );
}
