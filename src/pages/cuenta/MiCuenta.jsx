import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

const G   = '#1A3D28';
const ACC = '#4A9E6A';

export default function MiCuenta() {
  const { cliente } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const nombre  = cliente?.nombre  || 'Cliente';
  const empresa = cliente?.empresa || '';
  const email   = cliente?.email   || '';
  const codigo  = cliente?.codigo  || '';

  const path = location.pathname;
  const isResumen = path === '/cuenta' || path === '/cuenta/';
  const isPedidos = path.startsWith('/cuenta/pedidos');
  const isPerfil  = path.startsWith('/cuenta/perfil');

  const TABS = [
    { to: '/cuenta',          label: 'Resumen',     active: isResumen },
    { to: '/cuenta/pedidos',  label: 'Mis Pedidos', active: isPedidos },
    { to: '/cuenta/perfil',   label: 'Mi Perfil',   active: isPerfil  },
  ];

  return (
    <div style={{ maxWidth:780, margin:'0 auto', paddingBottom:60 }}>

      {/* ── Header ── */}
      <div style={{ background:G, color:'#F5F0E4' }}>
        <div style={{ borderBottom:'1px solid rgba(255,255,255,.1)', padding:'10px 24px', fontSize:'.7rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(245,240,228,.45)', fontWeight:600 }}>
          AGROINDUSTRIA AJÚA — Portal de Clientes
        </div>

        <div style={{ padding:'20px 24px 24px', display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:'1.4rem', fontWeight:800, letterSpacing:'-.01em', lineHeight:1.2 }}>{nombre}</div>
            {empresa && <div style={{ fontSize:'.88rem', color:'rgba(245,240,228,.65)', marginTop:3 }}>{empresa}</div>}
            <div style={{ fontSize:'.72rem', color:'rgba(245,240,228,.4)', marginTop:2 }}>
              {email}{codigo ? ` · ${codigo}` : ''}
              {cliente?.diasCredito > 0 ? ` · ${cliente.diasCredito} días crédito` : ' · Contado'}
            </div>
          </div>
          <button onClick={() => navigate('/')}
            style={{ padding:'12px 24px', background:ACC, color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:'pointer', letterSpacing:'.02em', whiteSpace:'nowrap', flexShrink:0 }}>
            + Nuevo Pedido
          </button>
        </div>

        <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,.1)' }}>
          {TABS.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.to==='/cuenta'} style={{ textDecoration:'none' }}>
              <div style={{
                padding:'13px 24px', fontSize:'.82rem', fontWeight:700, letterSpacing:'.02em',
                color: tab.active ? '#fff' : 'rgba(245,240,228,.45)',
                borderBottom: tab.active ? '3px solid #8DC26F' : '3px solid transparent',
                transition:'all .15s', cursor:'pointer',
              }}>
                {tab.label}
              </div>
            </NavLink>
          ))}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ padding:'24px 20px' }}>
        <Outlet />
      </div>
    </div>
  );
}
