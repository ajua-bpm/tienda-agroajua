import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { fmtDate, fmtQ } from '../../utils/format.js';

const G     = '#1B5E20';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

export default function MiCalendario() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [mes, setMes] = useState(() => { const d=new Date(); return {y:d.getFullYear(),m:d.getMonth()}; });
  const [modal, setModal] = useState(null); // { date, eventos }

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,'t_ordenes'), where('clienteUid','==',user.uid));
    return onSnapshot(q, snap => setOrdenes(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, [user]);

  const today = new Date().toISOString().slice(0,10);

  // Build event map { dateStr: [{tipo, orden}] }
  const eventos = useMemo(() => {
    const m = {};
    const add = (d, tipo, o) => { if(!d)return; if(!m[d])m[d]=[]; m[d].push({tipo,orden:o}); };
    for (const o of ordenes) {
      const fe = o.fechaEntregaPromesada||o.fechaEntrega;
      if (fe && !['cancelada','pagada'].includes(o.estado)) add(fe,'ent',o);
      if (o.fechaPagoPromesada && ['entregada','facturada'].includes(o.estado)) add(o.fechaPagoPromesada,'pago',o);
    }
    return m;
  }, [ordenes]);

  // Build month grid (42 cells)
  const grid = useMemo(() => {
    const first = new Date(mes.y, mes.m, 1).getDay();
    const days  = new Date(mes.y, mes.m+1, 0).getDate();
    const cells = [];
    for (let i=0; i<42; i++) {
      const day = i - first + 1;
      cells.push(day>=1&&day<=days ? day : null);
    }
    return cells;
  }, [mes]);

  const dateStr = d => d ? `${mes.y}-${String(mes.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` : null;

  const prevMes = () => setMes(m=>m.m===0?{y:m.y-1,m:11}:{y:m.y,m:m.m-1});
  const nextMes = () => setMes(m=>m.m===11?{y:m.y+1,m:0}:{y:m.y,m:m.m+1});

  const mesEventos = Object.entries(eventos)
    .filter(([d])=>d.startsWith(`${mes.y}-${String(mes.m+1).padStart(2,'0')}`))
    .sort(([a],[b])=>a.localeCompare(b));

  return (
    <div style={{padding:'24px 28px 80px',maxWidth:820}}>
      <div style={{fontSize:'1.2rem',fontWeight:900,color:G,marginBottom:20}}>Mi Calendario</div>

      {/* Leyenda */}
      <div style={{display:'flex',gap:16,marginBottom:16,fontSize:'.75rem',fontWeight:600}}>
        <span><span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:'#1565C0',marginRight:5}} />Entrega</span>
        <span><span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:'#F57F17',marginRight:5}} />Pago</span>
        <span><span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:'#C62828',marginRight:5}} />Pago vencido</span>
      </div>

      {/* Calendar */}
      <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 6px rgba(0,0,0,.07)',overflow:'hidden',marginBottom:20}}>
        {/* Nav */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',borderBottom:'1px solid #F0EDE6'}}>
          <button onClick={prevMes} style={{background:'none',border:'none',fontSize:'1.1rem',cursor:'pointer',color:G,fontWeight:700}}>‹</button>
          <div style={{fontWeight:700,color:G,fontSize:'.95rem'}}>{MESES[mes.m]} {mes.y}</div>
          <button onClick={nextMes} style={{background:'none',border:'none',fontSize:'1.1rem',cursor:'pointer',color:G,fontWeight:700}}>›</button>
        </div>
        {/* Day headers */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'1px solid #F0EDE6'}}>
          {DIAS.map(d=><div key={d} style={{padding:'8px 0',textAlign:'center',fontSize:'.68rem',fontWeight:700,color:'#aaa',textTransform:'uppercase'}}>{d}</div>)}
        </div>
        {/* Cells */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
          {grid.map((day,i)=>{
            const ds = dateStr(day);
            const evs = ds ? (eventos[ds]||[]) : [];
            const isToday = ds===today;
            const hasPagoVencido = evs.some(e=>e.tipo==='pago'&&ds<today);
            return (
              <div key={i}
                onClick={()=>evs.length&&setModal({date:ds,evs})}
                style={{minHeight:56,padding:'6px',borderRight:'1px solid #F5F3EF',borderBottom:'1px solid #F5F3EF',
                  background:isToday?'#E8F5E9':'#fff',cursor:evs.length?'pointer':'default',
                  opacity:day?1:0.3}}>
                {day&&<>
                  <div style={{fontSize:'.78rem',fontWeight:isToday?800:400,color:isToday?G:'#555',marginBottom:3}}>{day}</div>
                  <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                    {evs.map((e,ei)=>(
                      <div key={ei} style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                        background:e.tipo==='ent'?'#1565C0':hasPagoVencido?'#C62828':'#F57F17'}} />
                    ))}
                  </div>
                </>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Eventos del mes */}
      {mesEventos.length>0&&(
        <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 6px rgba(0,0,0,.07)',overflow:'hidden'}}>
          <div style={{padding:'12px 20px',borderBottom:'1px solid #F0EDE6',fontWeight:700,color:G,fontSize:'.85rem'}}>
            Eventos de {MESES[mes.m]}
          </div>
          {mesEventos.map(([d,evs])=>evs.map((e,i)=>(
            <div key={d+i} onClick={()=>navigate(`/cuenta/pedido/${e.orden.id}`)}
              style={{padding:'10px 20px',borderBottom:'1px solid #F5F3EF',display:'flex',justifyContent:'space-between',
                alignItems:'center',cursor:'pointer',fontSize:'.82rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                  background:e.tipo==='ent'?'#1565C0':(d<today?'#C62828':'#F57F17')}} />
                <span style={{color:'#555'}}>{fmtDate(d)}</span>
                <span style={{color:'#aaa'}}>·</span>
                <span style={{fontWeight:600,color:e.tipo==='pago'&&d<today?'#C62828':G}}>
                  {e.tipo==='ent'?'Entrega':'Pago'} — {e.orden.correlativo}
                </span>
              </div>
              <span style={{color:'#888'}}>{fmtQ(e.orden.total)}</span>
            </div>
          )))}
        </div>
      )}

      {/* Modal */}
      {modal&&(
        <div onClick={()=>setModal(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:'#fff',borderRadius:12,padding:24,maxWidth:360,width:'90%',boxShadow:'0 8px 32px rgba(0,0,0,.2)'}}>
            <div style={{fontWeight:700,color:G,marginBottom:14}}>{fmtDate(modal.date)}</div>
            {modal.evs.map((e,i)=>(
              <div key={i} onClick={()=>{navigate(`/cuenta/pedido/${e.orden.id}`);setModal(null);}}
                style={{padding:'10px 0',borderBottom:'1px solid #F5F3EF',cursor:'pointer',fontSize:'.85rem'}}>
                <div style={{fontWeight:600,color:G}}>{e.tipo==='ent'?'📦 Entrega':'💰 Pago'} — {e.orden.correlativo}</div>
                <div style={{color:'#888',marginTop:2}}>{fmtQ(e.orden.total)}</div>
              </div>
            ))}
            <button onClick={()=>setModal(null)}
              style={{marginTop:14,padding:'8px 20px',background:G,color:'#fff',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer',fontSize:'.82rem'}}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
