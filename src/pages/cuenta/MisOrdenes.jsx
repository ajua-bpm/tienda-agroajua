import { useEffect, useState, useMemo } from 'react';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { fmtQ, fmtDate, estadoColor, today, cap } from '../../utils/format.js';

const G = '#1A3D28';

const PIPELINE = ['nueva','confirmada','preparando','en_ruta','entregada','facturada','pagada'];

const TAB_ESTADOS = {
  activas:    ['nueva','confirmada','aprobada','preparando','en_ruta'],
  facturadas: ['facturada'],
  pagadas:    ['entregada','pagada'],
  canceladas: ['cancelada'],
};

export default function MisOrdenes() {
  const { user, cliente } = useAuth();
  const [ordenes, setOrdenes]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab,     setTab]       = useState('activas');
  const [detalle, setDetalle]   = useState(null);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 't_ordenes'),
      where('clienteUid', '==', user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      docs.sort((a, b) => (b.creadoEn?.seconds ?? 0) - (a.creadoEn?.seconds ?? 0));
      setOrdenes(docs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  const buckets = useMemo(() => {
    const b = { activas:[], facturadas:[], pagadas:[], canceladas:[] };
    for (const o of ordenes) {
      for (const [key, estados] of Object.entries(TAB_ESTADOS)) {
        if (estados.includes(o.estado)) { b[key].push(o); break; }
      }
    }
    return b;
  }, [ordenes]);

  // Pagadas: last 5 by default, filtrable by date
  const pagadasFiltradas = useMemo(() => {
    let list = buckets.pagadas;
    if (fechaDesde) list = list.filter(o => (o.fechaOrden||o.fecha||'') >= fechaDesde);
    if (fechaHasta) list = list.filter(o => (o.fechaOrden||o.fecha||'') <= fechaHasta);
    if (!fechaDesde && !fechaHasta) list = list.slice(0, 5);
    return list;
  }, [buckets.pagadas, fechaDesde, fechaHasta]);

  const currentList = tab === 'pagadas' ? pagadasFiltradas : buckets[tab] || [];

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#888' }}>Cargando órdenes…</div>;

  if (!ordenes.length) return (
    <div style={{ padding:'40px 28px', textAlign:'center', color:'#6B8070' }}>
      <div style={{ fontSize:'2rem', marginBottom:12 }}>📋</div>
      <div style={{ fontWeight:700, marginBottom:8 }}>Todavía no tenés pedidos</div>
      <div style={{ fontSize:'.85rem' }}>Una vez hagas tu primera orden de compra la verás aquí.</div>
    </div>
  );

  return (
    <div>
      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #F0F0EC', marginBottom:20 }}>
        {[
          ['activas',    `Activos (${buckets.activas.length})`],
          ['facturadas', `Facturados (${buckets.facturadas.length})`],
          ['pagadas',    `Historial (${buckets.pagadas.length})`],
          ['canceladas', `Cancelados (${buckets.canceladas.length})`],
        ].map(([t, l]) => (
          <button key={t} onClick={() => { setTab(t); setDetalle(null); setFechaDesde(''); setFechaHasta(''); }}
            style={{
              padding:'10px 20px', border:'none', cursor:'pointer', fontFamily:'inherit',
              fontSize:'.78rem', fontWeight:700,
              background:tab===t?'#fff':'transparent',
              color:tab===t?G:'#888',
              borderBottom:tab===t?`2px solid ${G}`:'2px solid transparent',
              marginBottom:-2,
            }}>{l}
          </button>
        ))}
      </div>

      {/* Pagadas date filter */}
      {tab === 'pagadas' && (
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
          <span style={{ fontSize:'.78rem', color:'#888' }}>Filtrar por fecha:</span>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
            style={{ padding:'5px 8px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.8rem', outline:'none' }} />
          <span style={{ fontSize:'.78rem', color:'#888' }}>a</span>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
            style={{ padding:'5px 8px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.8rem', outline:'none' }} />
          {(fechaDesde || fechaHasta) && (
            <button onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
              style={{ padding:'5px 12px', background:'transparent', color:'#888', border:'1px solid #E0E0E0', borderRadius:4, fontSize:'.75rem', cursor:'pointer' }}>
              Limpiar
            </button>
          )}
          {!fechaDesde && !fechaHasta && buckets.pagadas.length > 5 && (
            <span style={{ fontSize:'.75rem', color:'#888' }}>Mostrando últimas 5 de {buckets.pagadas.length}</span>
          )}
        </div>
      )}

      {/* Credit info banner */}
      {cliente?.diasCredito > 0 && (
        <div style={{ background:'#E3F2FD', border:'1px solid #BBDEFB', borderRadius:6, padding:'8px 16px', marginBottom:16, fontSize:'.8rem', color:'#1565C0' }}>
          Tu cuenta tiene <strong>{cliente.diasCredito} días de crédito</strong> desde la fecha de entrega.
        </div>
      )}

      {!currentList.length && (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#aaa' }}>Sin órdenes en este estado.</div>
      )}

      {/* Orden cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {currentList.map(orden => {
          const { color } = estadoColor(orden.estado);
          const estIdx = PIPELINE.indexOf(orden.estado);
          const isOpen = detalle === orden.id;
          const vencida = orden.fechaPagoPromesada && orden.fechaPagoPromesada < today() && !['pagada','cancelada'].includes(orden.estado);

          return (
            <div key={orden.id} style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflow:'hidden', border:`1.5px solid ${isOpen?G:'transparent'}` }}>
              {/* Card header */}
              <div style={{ padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
                onClick={() => setDetalle(isOpen ? null : orden.id)}>
                <div style={{ display:'flex', gap:18, alignItems:'center', flexWrap:'wrap' }}>
                  <div>
                    <div style={{ fontWeight:800, color:G, fontSize:'.92rem' }}>{orden.correlativo||'—'}</div>
                    <div style={{ fontSize:'.75rem', color:'#888' }}>{fmtDate(orden.fechaOrden||orden.fecha)}</div>
                  </div>
                  {orden.sucursalNombre && (
                    <div style={{ fontSize:'.78rem', color:'#4A9E6A', fontWeight:600 }}>{orden.sucursalNombre}</div>
                  )}
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:color, display:'inline-block' }} />
                    <span style={{ fontSize:'.78rem', fontWeight:700, color }}>{cap(orden.estado)}</span>
                  </div>
                  {vencida && <span style={{ fontSize:'.72rem', fontWeight:700, color:'#C62828', background:'#FFEBEE', padding:'2px 8px', borderRadius:12 }}>⚠ Pago vencido</span>}
                </div>
                <div style={{ display:'flex', gap:20, alignItems:'center' }}>
                  <div style={{ fontWeight:800, fontSize:'1rem', color:G }}>{fmtQ(orden.total)}</div>
                  <span style={{ color:'#888', fontSize:'1rem' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Pipeline progress (for active orders) */}
              {tab === 'activas' && estIdx >= 0 && (
                <div style={{ padding:'0 20px 8px', overflowX:'auto' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:0, minWidth:300 }}>
                    {PIPELINE.map((e, i) => {
                      const done    = i <= estIdx;
                      const current = i === estIdx;
                      const { color: ec } = estadoColor(e);
                      return (
                        <div key={e} style={{ display:'flex', alignItems:'center', flex:1 }}>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                            <div style={{
                              width:18, height:18, borderRadius:'50%',
                              background: done?(current?ec:'#4A9E6A'):'#E0E0E0',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:'.55rem', color:'#fff', fontWeight:800,
                            }}>{done&&!current?'✓':''}</div>
                            <div style={{ fontSize:'.5rem', color:done?'#333':'#ccc', fontWeight:current?800:400, textAlign:'center', whiteSpace:'nowrap' }}>
                              {cap(e)}
                            </div>
                          </div>
                          {i < PIPELINE.length-1 && (
                            <div style={{ flex:1, height:2, background:i<estIdx?'#4A9E6A':'#E0E0E0', margin:'0 1px 14px' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detail */}
              {isOpen && (
                <div style={{ borderTop:'1px solid #F0F0EC', padding:'14px 20px' }}>
                  {/* Dates block */}
                  <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:14, fontSize:'.8rem' }}>
                    {(orden.fechaEntregaPromesada||orden.fechaEntrega) && <DateInfo label="Entrega prometida" value={fmtDate(orden.fechaEntregaPromesada||orden.fechaEntrega)} />}
                    {orden.fechaEntregaReal      && <DateInfo label="Entrega real"       value={fmtDate(orden.fechaEntregaReal)} />}
                    {orden.fechaFactura          && <DateInfo label="Fecha factura"      value={fmtDate(orden.fechaFactura)} />}
                    {orden.numeroFEL             && <DateInfo label="No. FEL"            value={orden.numeroFEL} />}
                    {orden.fechaPagoPromesada    && (
                      <DateInfo label="Pago prometido" value={fmtDate(orden.fechaPagoPromesada)}
                        color={vencida?'#C62828':undefined} />
                    )}
                    {orden.fechaPagoReal && <DateInfo label="Pago realizado" value={fmtDate(orden.fechaPagoReal)} color='#1B5E20' />}
                  </div>

                  {/* Items table */}
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem', marginBottom:12 }}>
                    <thead>
                      <tr style={{ background:'#F5F5F0' }}>
                        <th style={{ padding:'6px 10px', textAlign:'left', fontWeight:700, color:'#888', fontSize:'.7rem', textTransform:'uppercase' }}>Producto</th>
                        <th style={{ padding:'6px 10px', textAlign:'center', fontWeight:700, color:'#888', fontSize:'.7rem', textTransform:'uppercase', width:60 }}>Cant.</th>
                        <th style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#888', fontSize:'.7rem', textTransform:'uppercase', width:90 }}>Precio</th>
                        <th style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#888', fontSize:'.7rem', textTransform:'uppercase', width:90 }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orden.items||[]).map((item, i) => (
                        <tr key={i} style={{ borderBottom:'1px solid #F5F5F0' }}>
                          <td style={{ padding:'7px 10px' }}>
                            <div style={{ fontWeight:600 }}>{item.nombre||item.descripcion||'—'}</div>
                            {item.descripcion && item.nombre && <div style={{ fontSize:'.72rem', color:'#888' }}>{item.descripcion}</div>}
                          </td>
                          <td style={{ padding:'7px 10px', textAlign:'center', color:'#555' }}>{item.cantidad} {item.unidad||''}</td>
                          <td style={{ padding:'7px 10px', textAlign:'right', color:'#555' }}>{fmtQ(item.precioUnitario||item.precio||0)}</td>
                          <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:G }}>{fmtQ(item.subtotal||0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, fontSize:'.82rem' }}>
                    <div style={{ color:'#888' }}>Subtotal neto: <strong>{fmtQ((orden.total||0)/1.12)}</strong></div>
                    <div style={{ color:'#888' }}>IVA 12%: <strong>{fmtQ((orden.total||0)-(orden.total||0)/1.12)}</strong></div>
                    <div style={{ fontWeight:900, fontSize:'1rem', color:G }}>Total: {fmtQ(orden.total)}</div>
                  </div>

                  {/* Payment status banner */}
                  {orden.fechaPagoPromesada && !['pagada','cancelada'].includes(orden.estado) && (
                    <div style={{ marginTop:12, padding:'10px 14px', borderRadius:6, background:vencida?'#FFEBEE':'#FFF3E0', border:`1px solid ${vencida?'#EF9A9A':'#FFB74D'}`, fontSize:'.82rem' }}>
                      <span style={{ fontWeight:700, color:vencida?'#C62828':'#E65100' }}>
                        {vencida ? '⚠ Pago VENCIDO' : '💰 Pago pendiente'}: {fmtQ(orden.total)} — vence {fmtDate(orden.fechaPagoPromesada)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DateInfo({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', color:'#aaa', letterSpacing:'.05em' }}>{label}</div>
      <div style={{ fontWeight:700, color:color||'#333' }}>{value}</div>
    </div>
  );
}
