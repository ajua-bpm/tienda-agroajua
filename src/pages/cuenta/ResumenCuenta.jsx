import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { fmtQ, fmtDate, estadoColor, today, cap } from '../../utils/format.js';

const G = '#1A3D28';
const ACTIVOS = ['nueva','confirmada','aprobada','preparando','en_ruta'];

export default function ResumenCuenta() {
  const { user, cliente } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 't_ordenes'), where('clienteUid', '==', user.uid));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      docs.sort((a,b) => (b.creadoEn?.seconds ?? 0) - (a.creadoEn?.seconds ?? 0));
      setOrdenes(docs);
      setLoading(false);
    }, () => setLoading(false));
  }, [user]);

  const { saldo, saldoVenc, proxima, activas } = useMemo(() => {
    const pendientes = ordenes.filter(o => ['entregada','facturada'].includes(o.estado));
    const saldo      = pendientes.reduce((s,o) => s+(o.total||0), 0);
    const todayStr   = today();
    const saldoVenc  = pendientes.filter(o => o.fechaPagoPromesada && o.fechaPagoPromesada < todayStr).reduce((s,o) => s+(o.total||0), 0);
    const proxima    = [...pendientes].sort((a,b) => (a.fechaPagoPromesada||'z').localeCompare(b.fechaPagoPromesada||'z'))[0];
    const activas    = ordenes.filter(o => ACTIVOS.includes(o.estado)).slice(0, 5);
    return { saldo, saldoVenc, proxima, activas };
  }, [ordenes]);

  const sucursales = (cliente?.sucursales || []).filter(s => s.activa !== false);

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#888' }}>Cargando…</div>;

  return (
    <div style={{ maxWidth:680 }}>

      {/* ── Stats ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        <StatCard label="Saldo pendiente" value={fmtQ(saldo)}     color={saldo>0?'#E65100':G} />
        <StatCard label="Saldo vencido"   value={fmtQ(saldoVenc)} color={saldoVenc>0?'#C62828':G} />
        <StatCard label="Pedidos activos" value={ordenes.filter(o => ACTIVOS.includes(o.estado)).length} />
        <StatCard label="Crédito"         value={cliente?.diasCredito ? `${cliente.diasCredito} días` : 'Contado'} />
      </div>

      {/* ── Saldo vencido aviso ── */}
      {saldoVenc > 0 && (
        <div style={{ background:'#FFEBEE', border:'1px solid #EF9A9A', borderRadius:8, padding:'12px 18px', marginBottom:16, fontSize:'.83rem', color:'#C62828', fontWeight:700 }}>
          ⚠ Tenés {fmtQ(saldoVenc)} en pagos vencidos. Contactá a tu ejecutivo AJÚA.
        </div>
      )}

      {/* ── Próximo pago ── */}
      {proxima && (
        <div style={{ background:'#FFF3E0', border:'1px solid #FFB74D', borderRadius:8, padding:'14px 18px', marginBottom:20 }}>
          <div style={{ fontWeight:700, color:'#E65100', marginBottom:4, fontSize:'.72rem', textTransform:'uppercase', letterSpacing:'.06em' }}>Próximo pago</div>
          <div style={{ fontWeight:800, fontSize:'1.1rem', color:'#1A1A18' }}>{fmtQ(proxima.total)}</div>
          <div style={{ fontSize:'.8rem', color:'#888', marginTop:3 }}>
            {proxima.correlativo} · vence {fmtDate(proxima.fechaPagoPromesada)}
          </div>
        </div>
      )}

      {/* ── Pedidos activos ── */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'#888' }}>Pedidos activos</div>
          <Link to="/cuenta/pedidos" style={{ fontSize:'.78rem', color:G, fontWeight:700, textDecoration:'none' }}>Ver todos →</Link>
        </div>
        {!activas.length ? (
          <div style={{ color:'#aaa', fontSize:'.85rem', padding:'16px 0' }}>Sin pedidos activos.</div>
        ) : activas.map(o => {
          const { color } = estadoColor(o.estado);
          return (
            <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#fff', borderRadius:6, marginBottom:6, boxShadow:'0 1px 3px rgba(0,0,0,.05)', border:'1.5px solid #F0F0EC' }}>
              <div>
                <span style={{ fontWeight:800, color:G, fontSize:'.88rem' }}>{o.correlativo||'—'}</span>
                <span style={{ display:'inline-flex', alignItems:'center', gap:4, marginLeft:10, fontSize:'.75rem', fontWeight:700, color }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block' }} />{cap(o.estado)}
                </span>
                {(o.fechaEntregaPromesada||o.fechaEntrega) && (
                  <div style={{ fontSize:'.72rem', color:'#888', marginTop:2 }}>Entrega: {fmtDate(o.fechaEntregaPromesada||o.fechaEntrega)}</div>
                )}
              </div>
              <span style={{ fontWeight:800, color:G }}>{fmtQ(o.total)}</span>
            </div>
          );
        })}
      </div>

      {/* ── Sucursales ── */}
      {sucursales.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'#888', marginBottom:10 }}>
            Puntos de entrega ({sucursales.length})
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {sucursales.map(s => (
              <div key={s.id} style={{ background:'#F5F5F0', borderRadius:6, padding:'8px 14px' }}>
                <div style={{ fontWeight:700, color:G, fontSize:'.83rem' }}>{s.nombre}</div>
                {s.direccion && <div style={{ color:'#888', fontSize:'.72rem', marginTop:2 }}>{s.direccion}</div>}
                {s.contacto  && <div style={{ color:'#aaa', fontSize:'.7rem'  }}>{s.contacto}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding:'12px 16px', background:'#E8F5E9', borderRadius:6, fontSize:'.8rem', color:'#1B5E20' }}>
        Consultas de cuenta y facturación: <strong>agroajua@gmail.com</strong>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background:'#F5F5F0', borderRadius:8, padding:'14px 16px' }}>
      <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:6 }}>{label}</div>
      <div style={{ fontWeight:800, fontSize:'1.1rem', color:color||G }}>{value}</div>
    </div>
  );
}
