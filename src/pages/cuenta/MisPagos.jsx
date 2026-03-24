import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { fmtQ, fmtDate } from '../../utils/format.js';

const G = '#1B5E20';

export default function MisPagos() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,'t_ordenes'), where('clienteUid','==',user.uid));
    return onSnapshot(q, snap => {
      setOrdenes(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
  }, [user]);

  // Flatten all pagos from all orders
  const pagos = useMemo(() => {
    const list = [];
    for (const o of ordenes) {
      const pagosOrden = o.pago?.pagos || [];
      if (pagosOrden.length) {
        pagosOrden.forEach(p => list.push({ ...p, correlativo: o.correlativo, ordenId: o.id }));
      } else if (o.pago?.estado==='pagado') {
        list.push({ fecha: o.pago.fecha||null, monto: o.total, referencia: o.pago.referencia||'—',
          metodo: o.pago.metodo||'—', correlativo: o.correlativo, ordenId: o.id });
      }
    }
    return list.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  }, [ordenes]);

  const totalPagado = pagos.reduce((s,p)=>s+(p.monto||0),0);

  const pendientes = useMemo(()=>
    ordenes.filter(o=>['entregada','facturada'].includes(o.estado)&&o.pago?.estado!=='pagado')
  , [ordenes]);
  const saldoPendiente = pendientes.reduce((s,o)=>s+(o.total||0),0);

  const METODO_ICON = { transferencia:'🏦', efectivo:'💵', cheque:'📝', tarjeta:'💳' };

  if (loading) return <div style={{padding:'60px',textAlign:'center',color:'#aaa'}}>Cargando…</div>;

  return (
    <div style={{padding:'24px 28px 80px',maxWidth:820}}>
      <div style={{fontSize:'1.2rem',fontWeight:900,color:G,marginBottom:20}}>Mis Pagos</div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:24}}>
        <div style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:'.68rem',color:'#aaa',fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>✅ Total pagado</div>
          <div style={{fontSize:'1.25rem',fontWeight:900,color:G}}>{fmtQ(totalPagado)}</div>
        </div>
        <div style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:'.68rem',color:'#aaa',fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>⏳ Saldo pendiente</div>
          <div style={{fontSize:'1.25rem',fontWeight:900,color:saldoPendiente>0?'#C62828':'#555'}}>{fmtQ(saldoPendiente)}</div>
        </div>
      </div>

      {/* Pendientes de pago */}
      {pendientes.length>0&&(
        <div style={{background:'#FFF8E1',border:'1px solid #F9A825',borderRadius:12,padding:'16px 20px',marginBottom:20}}>
          <div style={{fontWeight:700,color:'#F57F17',fontSize:'.85rem',marginBottom:10}}>⏳ Pendientes de pago</div>
          {pendientes.map(o=>(
            <div key={o.id} style={{display:'flex',justifyContent:'space-between',fontSize:'.82rem',padding:'5px 0',borderBottom:'1px solid #FFE082',color:'#555'}}>
              <span>{o.correlativo} · {fmtQ(o.total)}</span>
              {o.fechaPagoPromesada&&<span style={{color:'#F57F17',fontWeight:600}}>Vence: {fmtDate(o.fechaPagoPromesada)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Historial */}
      <div style={{fontWeight:700,color:G,fontSize:'.85rem',marginBottom:12}}>Historial de pagos</div>
      {pagos.length===0 ? (
        <div style={{padding:'40px',textAlign:'center',color:'#bbb'}}>
          <div style={{fontSize:'2rem',marginBottom:12}}>💰</div>
          Sin pagos registrados aún.
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {pagos.map((p,i)=>(
            <div key={i} style={{background:'#fff',borderRadius:12,padding:'14px 20px',
              boxShadow:'0 1px 6px rgba(0,0,0,.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <span style={{fontSize:'1rem'}}>{METODO_ICON[p.metodo?.toLowerCase()]||'💳'}</span>
                  <span style={{fontWeight:600,color:'#222',fontSize:'.88rem'}}>{p.metodo||'—'}</span>
                  <span style={{fontSize:'.72rem',color:'#aaa'}}>· {p.correlativo}</span>
                </div>
                {p.referencia&&p.referencia!=='—'&&<div style={{fontSize:'.75rem',color:'#aaa'}}>Ref: {p.referencia}</div>}
                <div style={{fontSize:'.72rem',color:'#bbb',marginTop:2}}>{fmtDate(p.fecha)}</div>
              </div>
              <div style={{fontWeight:800,color:G,fontSize:'1rem'}}>{fmtQ(p.monto)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
