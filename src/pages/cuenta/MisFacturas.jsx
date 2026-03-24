import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { fmtQ, fmtDate, today } from '../../utils/format.js';

const G = '#1B5E20';

export default function MisFacturas() {
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

  const facturas = useMemo(() =>
    ordenes
      .filter(o => o.factura?.estado==='emitida')
      .sort((a,b)=>(b.factura?.fechaEmision||'').localeCompare(a.factura?.fechaEmision||''))
  , [ordenes]);

  const totalFacturado = facturas.reduce((s,o)=>s+(o.total||0),0);
  const hoy = today();

  const estadoFactura = o => {
    if (o.pago?.estado==='pagado') return { label:'Pagada', col:'#2E7D32', bg:'#E8F5E9' };
    if (o.fechaPagoPromesada && o.fechaPagoPromesada < hoy) return { label:'Vencida', col:'#C62828', bg:'#FFEBEE' };
    return { label:'Emitida', col:'#1565C0', bg:'#E3F2FD' };
  };

  if (loading) return <div style={{padding:'60px',textAlign:'center',color:'#aaa'}}>Cargando…</div>;

  return (
    <div style={{padding:'24px 28px 80px',maxWidth:820}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:20}}>
        <div>
          <div style={{fontSize:'1.2rem',fontWeight:900,color:G}}>Mis Facturas</div>
          <div style={{fontSize:'.8rem',color:'#aaa',marginTop:2}}>{facturas.length} factura{facturas.length!==1?'s':''}</div>
        </div>
        {facturas.length>0&&(
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'.68rem',color:'#aaa',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em'}}>Total facturado</div>
            <div style={{fontWeight:800,color:G,fontSize:'1.1rem'}}>{fmtQ(totalFacturado)}</div>
          </div>
        )}
      </div>

      {facturas.length===0 ? (
        <div style={{padding:'60px',textAlign:'center',color:'#bbb'}}>
          <div style={{fontSize:'2rem',marginBottom:12}}>🧾</div>
          Sin facturas emitidas aún.
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {facturas.map(o=>{
            const est = estadoFactura(o);
            return (
              <div key={o.id} style={{background:'#fff',borderRadius:12,padding:'16px 20px',
                boxShadow:'0 1px 6px rgba(0,0,0,.06)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                      <span style={{fontWeight:700,color:G,fontSize:'.9rem'}}>{o.factura.correlativo||'—'}</span>
                      <span style={{background:est.bg,color:est.col,padding:'2px 8px',borderRadius:4,fontSize:'.7rem',fontWeight:700}}>
                        {est.label}
                      </span>
                    </div>
                    <div style={{fontSize:'.75rem',color:'#aaa'}}>
                      Pedido: {o.correlativo} · {fmtDate(o.factura.fechaEmision)}
                    </div>
                    {o.factura.uuid&&(
                      <div style={{fontSize:'.68rem',color:'#bbb',marginTop:2,fontFamily:'monospace'}}>
                        UUID: {o.factura.uuid.slice(0,16)}…
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:800,color:'#111',fontSize:'1rem'}}>{fmtQ(o.total)}</div>
                    {o.fechaPagoPromesada&&(
                      <div style={{fontSize:'.72rem',color:o.fechaPagoPromesada<hoy?'#C62828':'#aaa',marginTop:2}}>
                        Vence: {fmtDate(o.fechaPagoPromesada)}
                      </div>
                    )}
                  </div>
                </div>
                {o.factura.xmlUrl&&(
                  <a href={o.factura.xmlUrl} target="_blank" rel="noreferrer"
                    style={{fontSize:'.75rem',color:G,fontWeight:600,textDecoration:'none'}}>
                    📄 Descargar XML →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
