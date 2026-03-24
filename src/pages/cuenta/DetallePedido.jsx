import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, serverTimestamp } from '../../firebase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { fmtQ, fmtDate, today } from '../../utils/format.js';

const G    = '#1B5E20';
const PIPE = ['solicitada','confirmada','en_ruta','entregada','facturada','pagada'];
const eCo  = { solicitada:'#1565C0',nueva:'#1565C0',confirmada:'#2E7D32',preparando:'#E65100',
               en_ruta:'#F57F17',entregada:'#1B5E20',facturada:'#0D47A1',pagada:'#388E3C',cancelada:'#C62828' };
const pipeIdx = e => { const i=PIPE.indexOf(e); return i>=0?i:(e==='nueva'||e==='preparando'?1:-1); };
const Row = ({l,v,col})=>(
  <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #F5F3EF',fontSize:'.83rem'}}>
    <span style={{color:'#aaa',fontWeight:600}}>{l}</span>
    <span style={{color:col||'#222',fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{v||'—'}</span>
  </div>
);

export default function DetallePedido() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [orden, setOrden]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [recepItems, setRecepItems] = useState([]);
  const [showRecep, setShowRecep]   = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db,'t_ordenes',id), s => {
      setOrden(s.exists()?{id:s.id,...s.data()}:null);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (orden?.items) {
      setRecepItems(orden.items.map(i=>({ nombre:i.nombre, cantidadPedida:i.cantidad, cantidadRecibida:i.cantidad, estado:'ok', nota:'' })));
    }
  }, [orden?.items?.length]);  // eslint-disable-line

  const handleRecepcion = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db,'t_ordenes',id), {
        recepcion: { fecha:today(), items:recepItems, confirmadoPor:user?.uid||'' },
        actualizadoEn: serverTimestamp(),
      });
      toast('✓ Recepción confirmada'); setShowRecep(false);
    } catch { toast('Error al guardar','error'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{padding:'60px',textAlign:'center',color:'#aaa'}}>Cargando…</div>;
  if (!orden)  return <div style={{padding:'60px',textAlign:'center',color:'#aaa'}}>Pedido no encontrado.</div>;

  const col  = eCo[orden.estado]||'#555';
  const idx  = pipeIdx(orden.estado);
  const fechaEnt = orden.fechaEntregaPromesada||orden.fechaEntrega||null;

  return (
    <div style={{padding:'24px 28px 80px',maxWidth:760}}>
      <button onClick={()=>navigate('/cuenta/pedidos')}
        style={{background:'none',border:'none',color:G,fontSize:'.82rem',fontWeight:600,cursor:'pointer',marginBottom:16,padding:0}}>
        ← Mis Pedidos
      </button>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
        <div>
          <div style={{fontSize:'1.5rem',fontWeight:900,color:G}}>{orden.correlativo||'—'}</div>
          <div style={{fontSize:'.8rem',color:'#aaa',marginTop:2}}>{fmtDate(orden.fecha)}{orden.sucursalNombre?` · ${orden.sucursalNombre}`:''}</div>
        </div>
        <span style={{background:col+'20',color:col,padding:'5px 14px',borderRadius:6,fontSize:'.8rem',fontWeight:700}}>
          {orden.estado?.replace('_',' ')||'—'}
        </span>
      </div>

      {/* Pipeline */}
      <div style={{background:'#fff',borderRadius:12,padding:'16px 20px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',marginBottom:16}}>
        <div style={{fontSize:'.7rem',color:'#aaa',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12}}>Estado del pedido</div>
        <div style={{display:'flex',alignItems:'center'}}>
          {PIPE.map((p,pi)=>(
            <div key={pi} style={{display:'flex',alignItems:'center',flex:pi<PIPE.length-1?1:'none'}}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{width:14,height:14,borderRadius:'50%',background:pi<=idx?col:'#E0E0E0',flexShrink:0}} />
                <div style={{fontSize:'.6rem',color:pi<=idx?col:'#bbb',whiteSpace:'nowrap',fontWeight:pi===idx?700:400}}>{p.replace('_',' ')}</div>
              </div>
              {pi<PIPE.length-1&&<div style={{flex:1,height:2,background:pi<idx?col:'#E0E0E0',margin:'0 4px',marginBottom:16}} />}
            </div>
          ))}
        </div>
      </div>

      {/* Items */}
      <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 6px rgba(0,0,0,.06)',marginBottom:16,overflow:'hidden'}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid #F5F3EF',fontWeight:700,color:G,fontSize:'.85rem'}}>Productos</div>
        {(orden.items||[]).map((item,i)=>(
          <div key={i} style={{padding:'10px 20px',borderBottom:'1px solid #F5F3EF',display:'flex',justifyContent:'space-between',fontSize:'.83rem'}}>
            <div>
              <span style={{fontWeight:600,color:'#222'}}>{item.nombre}</span>
              <span style={{color:'#aaa',marginLeft:8}}>{item.unidad}</span>
            </div>
            <div style={{display:'flex',gap:20,color:'#555'}}>
              <span>×{item.cantidad}</span>
              <span style={{fontWeight:700,color:G}}>{fmtQ(item.subtotal||item.precio*item.cantidad)}</span>
            </div>
          </div>
        ))}
        <div style={{padding:'12px 20px',display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
          <div style={{fontSize:'.8rem',color:'#aaa'}}>Subtotal neto: {fmtQ(orden.neto)}</div>
          <div style={{fontSize:'.8rem',color:'#aaa'}}>IVA 12%: {fmtQ(orden.iva)}</div>
          <div style={{fontWeight:800,color:G,fontSize:'1rem'}}>Total: {fmtQ(orden.total)}</div>
        </div>
      </div>

      {/* Info */}
      <div style={{background:'#fff',borderRadius:12,padding:'16px 20px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',marginBottom:16}}>
        <Row l="Dirección" v={orden.direccionStr} />
        <Row l="Fecha entrega prometida" v={fmtDate(fechaEnt)} />
        {orden.factura?.correlativo&&<Row l="Factura FEL" v={orden.factura.correlativo} />}
        {orden.factura?.fechaEmision&&<Row l="Fecha factura" v={fmtDate(orden.factura.fechaEmision)} />}
        {orden.fechaPagoPromesada&&<Row l="Fecha pago prometida" v={fmtDate(orden.fechaPagoPromesada)} />}
        {orden.notas&&<Row l="Notas" v={orden.notas} />}
      </div>

      {/* Recepción */}
      {orden.estado==='entregada'&&!orden.recepcion&&(
        <div style={{background:'#E8F5E9',border:`1.5px solid ${G}`,borderRadius:12,padding:'16px 20px'}}>
          {!showRecep ? (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:'.85rem',color:G,fontWeight:600}}>¿Ya recibiste este pedido?</div>
              <button onClick={()=>setShowRecep(true)}
                style={{padding:'9px 20px',background:G,color:'#fff',border:'none',borderRadius:8,fontWeight:700,fontSize:'.82rem',cursor:'pointer'}}>
                Confirmar recepción
              </button>
            </div>
          ) : (
            <div>
              <div style={{fontWeight:700,color:G,marginBottom:12,fontSize:'.88rem'}}>Confirmar cantidades recibidas</div>
              {recepItems.map((ri,i)=>(
                <div key={i} style={{display:'flex',gap:10,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>
                  <span style={{fontSize:'.8rem',flex:1,minWidth:120,color:'#333'}}>{ri.nombre}</span>
                  <input type="number" value={ri.cantidadRecibida} min={0} max={ri.cantidadPedida}
                    onChange={e=>setRecepItems(p=>{const n=[...p];n[i]={...n[i],cantidadRecibida:+e.target.value};return n;})}
                    style={{width:60,padding:'4px 8px',border:'1px solid #ccc',borderRadius:4,fontSize:'.82rem'}} />
                  <select value={ri.estado}
                    onChange={e=>setRecepItems(p=>{const n=[...p];n[i]={...n[i],estado:e.target.value};return n;})}
                    style={{padding:'4px 8px',border:'1px solid #ccc',borderRadius:4,fontSize:'.78rem'}}>
                    <option value="ok">OK</option>
                    <option value="parcial">Parcial</option>
                    <option value="rechazo">Rechazo</option>
                  </select>
                </div>
              ))}
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={handleRecepcion} disabled={saving}
                  style={{padding:'9px 22px',background:G,color:'#fff',border:'none',borderRadius:8,fontWeight:700,fontSize:'.82rem',cursor:'pointer'}}>
                  {saving?'Guardando…':'Guardar'}
                </button>
                <button onClick={()=>setShowRecep(false)}
                  style={{padding:'9px 16px',background:'transparent',border:'1px solid #ccc',borderRadius:8,fontSize:'.82rem',cursor:'pointer'}}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {orden.recepcion&&(
        <div style={{background:'#F1F8E9',border:'1px solid #AED581',borderRadius:12,padding:'12px 20px',fontSize:'.82rem',color:'#33691E'}}>
          ✓ Recepción confirmada el {fmtDate(orden.recepcion.fecha)}
        </div>
      )}
    </div>
  );
}
