import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { fmtQ, fmtDate, today } from '../../utils/format.js';

const G      = '#1B5E20';
const ACTIVOS = ['solicitada','nueva','confirmada','preparando','en_ruta'];
const PIPE    = ['solicitada','confirmada','en_ruta','entregada','facturada','pagada'];
const pipeIdx = e => { const i = PIPE.indexOf(e); return i >= 0 ? i : (ACTIVOS.includes(e) ? 1 : -1); };
const eCo     = { solicitada:'#1565C0',nueva:'#1565C0',confirmada:'#2E7D32',preparando:'#E65100',
                  en_ruta:'#F57F17',entregada:'#1B5E20',facturada:'#0D47A1',pagada:'#388E3C',cancelada:'#C62828' };

const iniciales = nombre => (nombre||'?').split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('');
const saludo    = () => { const h=new Date().getHours(); return h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches'; };

export default function DashboardCliente() {
  const { user, cliente } = useAuth();
  const navigate = useNavigate();
  const [ordenes, setOrdenes]   = useState([]);
  const [sucFiltro, setSucFiltro] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,'t_ordenes'), where('clienteUid','==',user.uid));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({id:d.id,...d.data()}));
      docs.sort((a,b)=>(b.creadoEn?.seconds??0)-(a.creadoEn?.seconds??0));
      setOrdenes(docs);
    });
  }, [user]);

  const stats = useMemo(() => {
    const activos   = ordenes.filter(o => ACTIVOS.includes(o.estado)).length;
    const enCamino  = ordenes.filter(o => o.estado==='en_ruta').length;
    const pendPago  = ordenes.filter(o => ['entregada','facturada'].includes(o.estado) && o.pago?.estado!=='pagado');
    const saldo     = pendPago.reduce((s,o)=>s+(o.total||0),0);
    const proxFecha = pendPago.map(o=>o.fechaPagoPromesada).filter(Boolean).sort()[0]??null;
    return { activos, enCamino, saldo, proxFecha };
  }, [ordenes]);

  const hoy       = today();
  const sucursales = (cliente?.sucursales||[]).filter(s=>s.activa!==false);
  const filtrados  = sucFiltro ? ordenes.filter(o=>o.sucursalId===sucFiltro) : ordenes;
  const recientes  = filtrados.slice(0,5);
  const nombre1   = cliente?.nombre?.split(' ')[0]||'';

  return (
    <div style={{ padding:'28px 28px 80px', maxWidth:900 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <div style={{ fontSize:'.75rem', color:'#aaa', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>
            {saludo()}
          </div>
          <div style={{ fontSize:'1.55rem', fontWeight:900, color:G, lineHeight:1.15 }}>
            {nombre1||cliente?.nombre||'Mi cuenta'}
          </div>
          <div style={{ fontSize:'.8rem', color:'#888', marginTop:4, display:'flex', gap:10 }}>
            {cliente?.empresa && <span>{cliente.empresa}</span>}
            {cliente?.codigo  && <span style={{ color:'#bbb' }}>· {cliente.codigo}</span>}
          </div>
        </div>
        <div style={{ width:52, height:52, borderRadius:'50%', background:G, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'1.1rem', flexShrink:0 }}>
          {iniciales(cliente?.nombre)}
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <Stat icon="📦" label="Activos"        value={stats.activos}          col={G} />
        <Stat icon="💰" label="Saldo pendiente" value={fmtQ(stats.saldo)}     col={stats.saldo>0?'#C62828':'#555'} />
        <Stat icon="🚛" label="En camino"       value={stats.enCamino}         col="#F57F17" />
        <Stat icon="📅" label="Próximo pago"
          value={stats.proxFecha ? fmtDate(stats.proxFecha):'—'}
          col={stats.proxFecha&&stats.proxFecha<=hoy?'#C62828':'#555'}
          sub={stats.proxFecha&&stats.proxFecha<=hoy?'⚠ Vencido':''} />
      </div>

      {/* ── Filtro sucursales ── */}
      {sucursales.length > 1 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          <Pill label="Todas" active={!sucFiltro} onClick={()=>setSucFiltro(null)} />
          {sucursales.map(s => (
            <Pill key={s.id} label={s.nombre} active={sucFiltro===s.id} onClick={()=>setSucFiltro(s.id===sucFiltro?null:s.id)} />
          ))}
        </div>
      )}

      {/* ── Pedidos recientes ── */}
      <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,.07)', overflow:'hidden', marginBottom:24 }}>
        <div style={{ padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #F0EDE6' }}>
          <div style={{ fontWeight:700, color:G, fontSize:'.9rem' }}>Pedidos recientes</div>
          <button onClick={()=>navigate('/cuenta/pedidos')}
            style={{ background:'none', border:'none', color:G, fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>
            Ver todos →
          </button>
        </div>
        {recientes.length===0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#bbb', fontSize:'.85rem' }}>
            Sin pedidos.{' '}
            <button onClick={()=>navigate('/')} style={{ background:'none',border:'none',color:G,fontWeight:700,cursor:'pointer' }}>
              Hacer el primero →
            </button>
          </div>
        ) : recientes.map((o,i) => {
          const idx = pipeIdx(o.estado);
          const col = eCo[o.estado]||'#555';
          const fechaEnt = o.fechaEntregaPromesada||o.fechaEntrega||null;
          return (
            <div key={o.id}
              onClick={()=>navigate(`/cuenta/pedido/${o.id}`)}
              style={{ padding:'14px 20px', borderBottom:i<recientes.length-1?'1px solid #F5F3EF':'none',
                cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
                gap:12, background:i%2?'#FAFAF7':'#fff' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontWeight:700, color:G, fontSize:'.88rem' }}>{o.correlativo||'—'}</span>
                  <span style={{ background:col+'22', color:col, padding:'2px 8px', borderRadius:4, fontSize:'.68rem', fontWeight:700 }}>
                    {o.estado}
                  </span>
                  {o.sucursalNombre && <span style={{ fontSize:'.72rem', color:'#aaa' }}>{o.sucursalNombre}</span>}
                </div>
                <div style={{ display:'flex', gap:4, alignItems:'center', marginBottom:4 }}>
                  {PIPE.map((_,pi) => (
                    <div key={pi} style={{ width:pi<=idx?10:8, height:pi<=idx?10:8, borderRadius:'50%',
                      background:pi<=idx?col:'#E0E0E0', transition:'all .2s' }} />
                  ))}
                </div>
                {fechaEnt && <div style={{ fontSize:'.72rem', color:'#aaa' }}>Entrega: {fmtDate(fechaEnt)}</div>}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontWeight:700, color:G, fontSize:'.92rem' }}>{fmtQ(o.total)}</div>
                <div style={{ fontSize:'.72rem', color:'#bbb' }}>{fmtDate(o.fecha)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Acceso rápido ── */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <button onClick={()=>navigate('/cuenta/calendario')}
          style={{ padding:'11px 22px', background:'#fff', color:G, border:`1.5px solid ${G}`, borderRadius:8, fontWeight:600, fontSize:'.85rem', cursor:'pointer' }}>
          📅 Calendario
        </button>
        <button onClick={()=>navigate('/cuenta/perfil')}
          style={{ padding:'11px 22px', background:'#fff', color:'#555', border:'1px solid #DDD', borderRadius:8, fontWeight:600, fontSize:'.85rem', cursor:'pointer' }}>
          👤 Mi perfil
        </button>
      </div>

      {/* ── FAB móvil ── */}
      <button onClick={()=>navigate('/')}
        style={{ position:'fixed', bottom:72, right:20, width:56, height:56, borderRadius:'50%',
          background:G, color:'#fff', border:'none', fontSize:'1.4rem', cursor:'pointer',
          boxShadow:'0 4px 16px rgba(27,94,32,.45)', zIndex:100 }}>
        🛒
      </button>
    </div>
  );
}

function Stat({ icon, label, value, col, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:10, padding:'14px 16px', boxShadow:'0 1px 6px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize:'.65rem', color:'#aaa', fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{icon} {label}</div>
      <div style={{ fontSize:'1.25rem', fontWeight:900, color:col||'#333' }}>{value}</div>
      {sub && <div style={{ fontSize:'.68rem', color:col, marginTop:2, fontWeight:600 }}>{sub}</div>}
    </div>
  );
}

function Pill({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding:'6px 14px', borderRadius:20, border:`1.5px solid ${active?G:'#DDD'}`,
        background:active?G:'#fff', color:active?'#fff':'#555',
        fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>
      {label}
    </button>
  );
}
