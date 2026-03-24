import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { fmtQ, fmtDate } from '../../utils/format.js';

const G      = '#1B5E20';
const PAGE   = 10;
const PIPE   = ['solicitada','confirmada','en_ruta','entregada','facturada','pagada'];
const ESTADOS = ['Todos','solicitada','confirmada','en_ruta','entregada','facturada','pagada','cancelada'];
const eCo    = { solicitada:'#1565C0',nueva:'#1565C0',confirmada:'#2E7D32',preparando:'#E65100',
                 en_ruta:'#F57F17',entregada:'#1B5E20',facturada:'#0D47A1',pagada:'#388E3C',cancelada:'#C62828' };
const pipeIdx = e => { const i=PIPE.indexOf(e); return i>=0?i:(e==='nueva'||e==='preparando'?1:-1); };

export default function MisPedidos() {
  const { user, cliente } = useAuth();
  const navigate = useNavigate();
  const [ordenes,  setOrdenes]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [estFiltro,setEstFiltro]= useState('Todos');
  const [sucFiltro,setSucFiltro]= useState('');
  const [visible,  setVisible]  = useState(PAGE);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,'t_ordenes'), where('clienteUid','==',user.uid));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      docs.sort((a,b)=>(b.creadoEn?.seconds??0)-(a.creadoEn?.seconds??0));
      setOrdenes(docs); setLoading(false);
    });
  }, [user]);

  const sucursales = useMemo(()=>[...new Set(ordenes.map(o=>o.sucursalNombre).filter(Boolean))],[ordenes]);

  const filtrados = useMemo(()=>
    ordenes.filter(o=>{
      if (estFiltro!=='Todos' && o.estado!==estFiltro) return false;
      if (sucFiltro && o.sucursalNombre!==sucFiltro) return false;
      return true;
    }),[ordenes,estFiltro,sucFiltro]);

  return (
    <div style={{padding:'28px 28px 80px',maxWidth:860}}>

      {/* Title */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:'1.2rem',fontWeight:900,color:G}}>Mis Pedidos</div>
        <div style={{fontSize:'.8rem',color:'#aaa',marginTop:2}}>{filtrados.length} pedido{filtrados.length!==1?'s':''}</div>
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:20}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {ESTADOS.map(e=>(
            <button key={e} onClick={()=>{setEstFiltro(e);setVisible(PAGE);}}
              style={{padding:'6px 13px',borderRadius:20,border:`1.5px solid ${estFiltro===e?G:'#DDD'}`,
                background:estFiltro===e?G:'#fff',color:estFiltro===e?'#fff':'#555',
                fontSize:'.75rem',fontWeight:600,cursor:'pointer'}}>
              {e==='Todos'?'Todos':e.replace('_',' ')}
            </button>
          ))}
        </div>
        {sucursales.length>0&&(
          <select value={sucFiltro} onChange={e=>{setSucFiltro(e.target.value);setVisible(PAGE);}}
            style={{padding:'6px 10px',border:'1.5px solid #DDD',borderRadius:6,fontSize:'.78rem',color:'#555',background:'#fff',cursor:'pointer'}}>
            <option value=''>Todas las sucursales</option>
            {sucursales.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{padding:'60px',textAlign:'center',color:'#aaa'}}>Cargando…</div>
      ) : filtrados.length===0 ? (
        <div style={{padding:'60px',textAlign:'center',color:'#bbb'}}>
          <div style={{fontSize:'2rem',marginBottom:12}}>📦</div>
          Sin pedidos{estFiltro!=='Todos'?` con estado "${estFiltro}"`:''}.
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filtrados.slice(0,visible).map(o=>{
            const col = eCo[o.estado]||'#555';
            const idx = pipeIdx(o.estado);
            const prods = (o.items||[]).slice(0,2).map(i=>i.nombre).join(', ');
            const extra = (o.items||[]).length>2?` +${o.items.length-2} más`:'';
            const fechaEnt = o.fechaEntregaPromesada||o.fechaEntrega||null;
            return (
              <div key={o.id} onClick={()=>navigate(`/cuenta/pedido/${o.id}`)}
                style={{background:'#fff',borderRadius:12,padding:'16px 20px',
                  boxShadow:'0 1px 6px rgba(0,0,0,.06)',cursor:'pointer',
                  border:'1.5px solid transparent',transition:'border-color .15s',
                  ':hover':{borderColor:G}}}>
                {/* Fila superior */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontWeight:700,color:G,fontSize:'.9rem'}}>{o.correlativo||'—'}</span>
                      <span style={{background:col+'20',color:col,padding:'2px 8px',borderRadius:4,fontSize:'.7rem',fontWeight:700}}>
                        {o.estado?.replace('_',' ')||'—'}
                      </span>
                    </div>
                    <div style={{fontSize:'.75rem',color:'#aaa',marginTop:3}}>
                      {fmtDate(o.fecha)}{o.sucursalNombre?` · ${o.sucursalNombre}`:''}
                      {fechaEnt?` · Entrega: ${fmtDate(fechaEnt)}`:''}
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:800,color:'#111',fontSize:'1rem'}}>{fmtQ(o.total)}</div>
                    <div style={{fontSize:'.7rem',color:'#bbb'}}>{(o.items||[]).length} productos</div>
                  </div>
                </div>
                {/* Productos */}
                {prods&&<div style={{fontSize:'.78rem',color:'#777',marginBottom:10,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {prods}{extra}
                </div>}
                {/* Pipeline */}
                <div style={{display:'flex',alignItems:'center',gap:0}}>
                  {PIPE.map((p,pi)=>(
                    <div key={pi} style={{display:'flex',alignItems:'center',flex:pi<PIPE.length-1?1:'none'}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:pi<=idx?col:'#E0E0E0',flexShrink:0}} />
                      {pi<PIPE.length-1&&<div style={{flex:1,height:2,background:pi<idx?col:'#E0E0E0',margin:'0 2px'}} />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ver más */}
      {filtrados.length>visible&&(
        <button onClick={()=>setVisible(v=>v+PAGE)}
          style={{display:'block',margin:'20px auto 0',padding:'10px 32px',background:'#fff',
            border:`1.5px solid ${G}`,color:G,borderRadius:8,fontWeight:600,fontSize:'.85rem',cursor:'pointer'}}>
          Ver más ({filtrados.length-visible} restantes)
        </button>
      )}
    </div>
  );
}
