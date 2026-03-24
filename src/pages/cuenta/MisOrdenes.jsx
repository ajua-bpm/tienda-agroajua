import { useEffect, useState } from 'react';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { fmtQ, fmtDate, estadoColor, cap } from '../../utils/format.js';

const G = '#1A3D28';

const ESTADO_ICON = {
  nueva:      '🆕',
  confirmada: '✅',
  aprobada:   '✅',
  preparando: '📦',
  en_ruta:    '🚚',
  entregada:  '✔',
  facturada:  '🧾',
  pagada:     '💰',
  cancelada:  '❌',
};

const PAGO_COLOR = {
  pendiente: { bg:'#FFF3E0', color:'#E65100' },
  parcial:   { bg:'#FFF8E1', color:'#F57F17' },
  pagado:    { bg:'#E8F5E9', color:'#1B5E20' },
};

export default function MisOrdenes() {
  const { user } = useAuth();
  const [ordenes, setOrdenes]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [filtro,   setFiltro]   = useState('todas');

  useEffect(() => {
    if (!user) return;
    // No compound index needed — filter only by clienteUid, sort client-side
    const q = query(
      collection(db, 't_ordenes'),
      where('clienteUid', '==', user.uid),
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.creadoEn?.seconds ?? 0;
          const tb = b.creadoEn?.seconds ?? 0;
          return tb - ta;
        });
      setOrdenes(docs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  const visible = filtro === 'todas'
    ? ordenes
    : ordenes.filter(o => {
        if (filtro === 'activas')   return !['entregada','pagada','cancelada'].includes(o.estado);
        if (filtro === 'entregadas') return ['entregada','pagada'].includes(o.estado);
        if (filtro === 'canceladas') return o.estado === 'cancelada';
        return true;
      });

  const counts = {
    todas:      ordenes.length,
    activas:    ordenes.filter(o => !['entregada','pagada','cancelada'].includes(o.estado)).length,
    entregadas: ordenes.filter(o => ['entregada','pagada'].includes(o.estado)).length,
    canceladas: ordenes.filter(o => o.estado === 'cancelada').length,
  };

  if (loading) return <div style={{ padding: 24, color: '#6B8070', fontSize: '.85rem' }}>Cargando historial…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, color: G, margin: 0 }}>Historial de Órdenes</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['todas','Todas'],['activas','Activas'],['entregadas','Entregadas'],['canceladas','Canceladas']].map(([k,l]) => (
            <button key={k} onClick={() => setFiltro(k)} style={{
              padding: '5px 12px', borderRadius: 100, border: '1.5px solid',
              borderColor: filtro === k ? G : '#E8DCC8',
              background: filtro === k ? G : '#FDFCF8',
              color: filtro === k ? '#F5F0E4' : '#555',
              fontSize: '.72rem', fontWeight: 600, cursor: 'pointer',
            }}>
              {l} {counts[k] > 0 && <span style={{ opacity:.7 }}>({counts[k]})</span>}
            </button>
          ))}
        </div>
      </div>

      {!visible.length ? (
        <div style={{ textAlign:'center', padding:'50px 20px', color:'#6B8070' }}>
          <div style={{ fontSize:'2rem', marginBottom:10 }}>📋</div>
          {filtro === 'todas' ? 'Aún no tenés órdenes registradas.' : `Sin órdenes en esta categoría.`}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {visible.map(o => {
            const { bg, color } = estadoColor(o.estado);
            const isOpen = selected?.id === o.id;
            const pagoBadge = PAGO_COLOR[o.pago?.estado] || PAGO_COLOR.pendiente;
            const iva  = o.iva  ?? (o.total ? o.total - o.total / 1.12 : 0);
            const neto = o.neto ?? (o.total ? o.total / 1.12 : 0);

            return (
              <div key={o.id} style={{ background:'#FDFCF8', border:`1px solid ${isOpen ? G : '#E8DCC8'}`, borderRadius:8, overflow:'hidden', transition:'border-color .15s' }}>

                {/* Row header */}
                <div
                  onClick={() => setSelected(isOpen ? null : o)}
                  style={{ padding:'14px 16px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:'1.1rem' }}>{ESTADO_ICON[o.estado] || '📋'}</span>
                    <div>
                      <div style={{ fontWeight:800, color:G, fontSize:'.92rem' }}>{o.correlativo || '—'}</div>
                      <div style={{ fontSize:'.73rem', color:'#6B8070', marginTop:1 }}>
                        Creada: {fmtDate(o.fecha)} · Entrega: {fmtDate(o.fechaEntrega)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    {/* Estado */}
                    <span style={{ padding:'3px 10px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background:bg, color }}>
                      {cap(o.estado)}
                    </span>
                    {/* Pago */}
                    <span style={{ padding:'3px 10px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background:pagoBadge.bg, color:pagoBadge.color }}>
                      💳 {cap(o.pago?.estado || 'pendiente')}
                    </span>
                    <span style={{ fontWeight:900, color:G, fontSize:'.95rem', minWidth:80, textAlign:'right' }}>{fmtQ(o.total)}</span>
                    <span style={{ fontSize:'.75rem', color:'#aaa' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop:'1px solid #E8DCC8' }}>

                    {/* Status timeline */}
                    <div style={{ padding:'12px 16px', background:'#F9F7F2', display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
                      {['nueva','confirmada','preparando','en_ruta','entregada','pagada'].map((est, i, arr) => {
                        const estadosOrden = ['nueva','confirmada','aprobada','preparando','en_ruta','entregada','facturada','pagada'];
                        const curIdx = estadosOrden.indexOf(o.estado);
                        const thisIdx = estadosOrden.indexOf(est);
                        const done = curIdx >= thisIdx && o.estado !== 'cancelada';
                        return (
                          <div key={est} style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <div style={{ padding:'3px 10px', borderRadius:100, fontSize:'.68rem', fontWeight:700,
                              background: done ? G : '#F0EDE6',
                              color: done ? '#F5F0E4' : '#aaa',
                            }}>
                              {ESTADO_ICON[est]} {cap(est)}
                            </div>
                            {i < arr.length - 1 && <span style={{ color:'#ccc', fontSize:'.7rem' }}>→</span>}
                          </div>
                        );
                      })}
                      {o.estado === 'cancelada' && (
                        <span style={{ padding:'3px 10px', borderRadius:100, fontSize:'.68rem', fontWeight:700, background:'#FFEBEE', color:'#C62828' }}>❌ Cancelada</span>
                      )}
                    </div>

                    {/* Items table */}
                    <div style={{ padding:'0 16px 12px' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', marginTop:12 }}>
                        <thead>
                          <tr style={{ background:'#F5F0E4' }}>
                            {['#','Producto','Unidad','Cant.','P. Unitario','P. Total'].map(h => (
                              <th key={h} style={{ padding:'7px 10px', fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', color:'#6B8070', textAlign:['P. Unitario','P. Total'].includes(h)?'right':['Cant.'].includes(h)?'center':'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(o.items || []).map((item, i) => (
                            <tr key={i} style={{ borderBottom:'1px solid #F0EBE0' }}>
                              <td style={{ padding:'7px 10px', fontSize:'.72rem', color:'#aaa' }}>{i+1}</td>
                              <td style={{ padding:'7px 10px', fontWeight:600, fontSize:'.83rem', color:G }}>{item.nombre}</td>
                              <td style={{ padding:'7px 10px', fontSize:'.8rem', color:'#6B8070' }}>{item.unidad}</td>
                              <td style={{ padding:'7px 10px', textAlign:'center', fontWeight:700 }}>{item.cantidad}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontSize:'.82rem', color:'#555' }}>{fmtQ(item.precio)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:G }}>{fmtQ(item.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Totals */}
                      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
                        <div style={{ minWidth:220, fontSize:'.8rem' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', color:'#6B8070', marginBottom:3 }}>
                            <span>Subtotal neto</span><span>{fmtQ(neto)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', color:'#6B8070', marginBottom:6 }}>
                            <span>IVA (12%)</span><span>{fmtQ(iva)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:'.92rem', color:G, paddingTop:6, borderTop:'2px solid #E8DCC8' }}>
                            <span>Total</span><span>{fmtQ(o.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Info chips */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8, marginTop:14 }}>
                        <InfoChip label="Punto de entrega" value={o.sucursalNombre || 'Dirección principal'} />
                        <InfoChip label="Dirección" value={typeof o.direccion==='string' ? o.direccion : o.direccionStr || '—'} />
                        <InfoChip label="Pago" value={cap(o.pago?.estado || 'pendiente')} highlight={o.pago?.estado==='pagado'} />
                        <InfoChip label="Método de pago" value={o.pago?.metodo ? cap(o.pago.metodo) : 'Por coordinar'} />
                        <InfoChip label="Factura" value={o.factura?.correlativo || 'Pendiente'} />
                        <InfoChip label="Entrega real" value={fmtDate(o.entrega?.fechaReal) || 'Pendiente'} />
                        {o.notas && <InfoChip label="Notas" value={o.notas} span />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoChip({ label, value, highlight, span }) {
  return (
    <div style={{ background: highlight ? '#E8F5E9' : '#F5F0E4', borderRadius:4, padding:'7px 10px', gridColumn: span ? 'span 2' : undefined }}>
      <div style={{ fontSize:'.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'#6B8070', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:'.8rem', color: highlight ? '#1B5E20' : G, fontWeight:600 }}>{value}</div>
    </div>
  );
}
