/**
 * ResumenCuenta — Dashboard B2B del cliente en /cuenta
 * Colores: #1B5E20 (G), #2E7D32 (G2), #E8F5E9 (GBGR)
 * Mobile-first, botones min 48px
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { fmtQ, fmtDate, estadoColor, today, cap } from '../../utils/format.js';

const G    = '#1B5E20';
const G2   = '#2E7D32';
const GBGR = '#E8F5E9';
const GDRK = '#0A3D1A';

const PIPELINE_STEPS = ['nueva','confirmada','preparando','en_ruta','entregada'];
const ACTIVOS        = ['nueva','confirmada','aprobada','preparando','en_ruta'];

export default function ResumenCuenta() {
  const { user, cliente } = useAuth();
  const navigate = useNavigate();
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

  const stats = useMemo(() => {
    const todayStr   = today();
    const pendientes = ordenes.filter(o => ['entregada','facturada'].includes(o.estado));
    const saldo      = pendientes.reduce((s,o) => s+(o.total||0), 0);
    const saldoVenc  = pendientes
      .filter(o => o.fechaPagoPromesada && o.fechaPagoPromesada < todayStr)
      .reduce((s,o) => s+(o.total||0), 0);
    const proxima    = [...pendientes]
      .sort((a,b) => (a.fechaPagoPromesada||'z').localeCompare(b.fechaPagoPromesada||'z'))[0];
    return {
      activos:     ordenes.filter(o => ACTIVOS.includes(o.estado)).length,
      enCamino:    ordenes.filter(o => o.estado === 'en_ruta').length,
      saldo, saldoVenc, proxima,
      recientes:   ordenes.slice(0, 5),
      pendientes,
    };
  }, [ordenes]);

  const sucursales = (cliente?.sucursales || []).filter(s => s.activa !== false);

  const pedidosPorSuc = useMemo(() => {
    const m = {};
    for (const o of ordenes) {
      if (ACTIVOS.includes(o.estado) && o.sucursalId) {
        m[o.sucursalId] = (m[o.sucursalId]||0) + 1;
      }
    }
    return m;
  }, [ordenes]);

  const diasHasta = fechaStr => {
    if (!fechaStr) return null;
    const diff = new Date(fechaStr + 'T12:00:00') - new Date();
    return Math.round(diff / 86400000);
  };

  if (loading) {
    return (
      <div style={{ padding:'60px 20px', textAlign:'center', color:'#888' }}>
        <div style={{ fontSize:'1.5rem', marginBottom:8 }}>🌿</div>
        Cargando tu cuenta…
      </div>
    );
  }

  return (
    <div style={{ paddingBottom:32 }}>

      {/* ══ CARDS RESUMEN ══════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }}>
        <StatCard icon="📦" label="Pedidos activos"  value={stats.activos}            />
        <StatCard icon="💰" label="Saldo pendiente"  value={fmtQ(stats.saldo)}        color={stats.saldo>0?'#E65100':G} />
        <StatCard icon="🚛" label="En camino"        value={stats.enCamino}            />
        <StatCard icon="📅" label="Próximo pago"
          value={stats.proxima ? fmtDate(stats.proxima.fechaPagoPromesada) : '—'}
          sub={stats.proxima ? fmtQ(stats.proxima.total) : null}
          color={stats.proxima ? '#E65100' : G}
        />
      </div>

      {/* Alerta vencido */}
      {stats.saldoVenc > 0 && (
        <div style={{ background:'#FFEBEE', border:'1.5px solid #EF9A9A', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:'.85rem', color:'#C62828', fontWeight:700 }}>
          ⚠ Tenés {fmtQ(stats.saldoVenc)} en pagos vencidos. Contactá a tu ejecutivo.
        </div>
      )}

      {/* ══ MIS SUCURSALES ═════════════════════════════════════════════════ */}
      {sucursales.length > 0 && (
        <Section title="Mis sucursales">
          {sucursales.map(s => {
            const nActivos = pedidosPorSuc[s.id] || 0;
            return (
              <div key={s.id} style={{ background:'#fff', borderRadius:8, border:'1.5px solid #E8F0E8', padding:'14px 16px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, color:G, fontSize:'.9rem', marginBottom:2 }}>{s.nombre}</div>
                  {s.direccion && <div style={{ fontSize:'.78rem', color:'#666', marginBottom:2 }}>{s.direccion}</div>}
                  {s.contacto  && <div style={{ fontSize:'.72rem', color:'#aaa' }}>{s.contacto}{s.telefono ? ` · ${s.telefono}` : ''}</div>}
                  {nActivos > 0 && (
                    <div style={{ marginTop:6, fontSize:'.75rem', fontWeight:700, color:G2, background:GBGR, display:'inline-block', padding:'2px 8px', borderRadius:10 }}>
                      {nActivos} pedido{nActivos!==1?'s':''} activo{nActivos!==1?'s':''}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate('/cuenta/ordenes')}
                  style={{ minHeight:40, padding:'8px 14px', background:GBGR, color:G, border:`1.5px solid ${G2}`, borderRadius:6, fontWeight:700, fontSize:'.78rem', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                  Ver pedidos →
                </button>
              </div>
            );
          })}
        </Section>
      )}

      {/* ══ PEDIDOS RECIENTES ══════════════════════════════════════════════ */}
      <Section title="Pedidos recientes" action={{ label:'Ver todos →', onClick:() => navigate('/cuenta/ordenes') }}>
        {!stats.recientes.length ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:'#aaa', fontSize:'.88rem' }}>
            <div style={{ fontSize:'2rem', marginBottom:8 }}>📋</div>
            Todavía no tenés pedidos.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:480 }}>
              <thead>
                <tr style={{ background:'#F9FBF9' }}>
                  {['Orden','Sucursal','Fecha','Total','Estado'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#888', textAlign:'left', borderBottom:'2px solid #E8F0E8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recientes.map(o => {
                  const { bg, color } = estadoColor(o.estado);
                  const pipeline = PIPELINE_STEPS;
                  const stepIdx  = pipeline.indexOf(o.estado);
                  const venc     = o.fechaPagoPromesada && o.fechaPagoPromesada < today() && !['pagada','cancelada'].includes(o.estado);
                  return (
                    <tr key={o.id} style={{ borderBottom:'1px solid #F0F5F0' }}>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ fontWeight:800, color:G, fontSize:'.88rem' }}>{o.correlativo||'—'}</div>
                        {venc && <div style={{ fontSize:'.65rem', color:'#C62828', fontWeight:700, marginTop:2 }}>⚠ PAGO VENCIDO</div>}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:'.78rem', color:'#666' }}>{o.sucursalNombre||'—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:'.78rem', color:'#888', whiteSpace:'nowrap' }}>{fmtDate(o.fechaOrden||o.fecha)}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:G, whiteSpace:'nowrap' }}>{fmtQ(o.total)}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <div>
                          <span style={{ display:'inline-block', background:bg, color, fontSize:'.7rem', fontWeight:700, padding:'2px 8px', borderRadius:10, whiteSpace:'nowrap' }}>
                            {cap(o.estado)}
                          </span>
                          {/* Pipeline mini */}
                          {stepIdx >= 0 && (
                            <div style={{ display:'flex', alignItems:'center', gap:2, marginTop:5 }}>
                              {pipeline.map((step, i) => (
                                <div key={step} style={{ display:'flex', alignItems:'center' }}>
                                  <div style={{ width:7, height:7, borderRadius:'50%', background: i<=stepIdx ? G2 : '#D8E8D8', flexShrink:0 }} />
                                  {i < pipeline.length-1 && <div style={{ width:8, height:2, background: i<stepIdx ? G2 : '#D8E8D8' }} />}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ══ ESTADO DE CUENTA ═══════════════════════════════════════════════ */}
      <Section title="Estado de cuenta">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <div style={{ background:'#F9FBF9', borderRadius:6, padding:'12px 14px', border:'1px solid #E8F0E8' }}>
            <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:4 }}>Condición de pago</div>
            <div style={{ fontWeight:800, color:G, fontSize:'.95rem' }}>
              {cliente?.diasCredito > 0 ? `${cliente.diasCredito} días crédito` : 'Contado'}
            </div>
          </div>
          <div style={{ background:'#F9FBF9', borderRadius:6, padding:'12px 14px', border:'1px solid #E8F0E8' }}>
            <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:4 }}>Facturas pendientes</div>
            <div style={{ fontWeight:800, color: stats.pendientes.length>0 ? '#E65100' : G, fontSize:'.95rem' }}>
              {stats.pendientes.length} factura{stats.pendientes.length!==1?'s':''}
            </div>
          </div>
        </div>

        {/* Próximo vencimiento */}
        {stats.proxima && (() => {
          const dias = diasHasta(stats.proxima.fechaPagoPromesada);
          const urgente = dias !== null && dias <= 3;
          return (
            <div style={{ background: urgente?'#FFF3E0':GBGR, border:`1.5px solid ${urgente?'#FFB74D':'#A5D6A7'}`, borderRadius:8, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', color: urgente?'#E65100':G, letterSpacing:'.06em', marginBottom:4 }}>
                {urgente ? '⚠ Próximo vencimiento — urgente' : '📅 Próximo vencimiento'}
              </div>
              <div style={{ fontWeight:900, fontSize:'1.1rem', color:urgente?'#E65100':G }}>{fmtQ(stats.proxima.total)}</div>
              <div style={{ fontSize:'.8rem', color:'#666', marginTop:4 }}>
                {stats.proxima.correlativo} · vence {fmtDate(stats.proxima.fechaPagoPromesada)}
                {dias !== null && <strong style={{ color:urgente?'#C62828':G2, marginLeft:8 }}>({dias >= 0 ? `en ${dias} día${dias!==1?'s':''}` : `hace ${Math.abs(dias)} día${Math.abs(dias)!==1?'s':''}`})</strong>}
              </div>
            </div>
          );
        })()}

        {/* Lista facturas pendientes */}
        {stats.pendientes.length > 0 && (
          <div>
            {stats.pendientes.slice(0,5).map(o => {
              const dias = diasHasta(o.fechaPagoPromesada);
              const venc = o.fechaPagoPromesada && o.fechaPagoPromesada < today();
              return (
                <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #F0F5F0', fontSize:'.83rem' }}>
                  <div>
                    <span style={{ fontWeight:700, color:G }}>{o.correlativo}</span>
                    {o.fechaPagoPromesada && (
                      <span style={{ color: venc?'#C62828':'#888', marginLeft:10, fontSize:'.75rem' }}>
                        vence {fmtDate(o.fechaPagoPromesada)}{venc?' ⚠':''}
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight:800, color: venc?'#C62828':G }}>{fmtQ(o.total)}</span>
                </div>
              );
            })}
            {stats.pendientes.length > 5 && (
              <div style={{ fontSize:'.75rem', color:'#888', marginTop:8, textAlign:'right' }}>
                +{stats.pendientes.length - 5} más · <button onClick={() => navigate('/cuenta/ordenes')} style={{ background:'none', border:'none', color:G, fontWeight:700, cursor:'pointer', fontSize:'.75rem' }}>Ver historial completo →</button>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ══ ACCESO RÁPIDO ══════════════════════════════════════════════════ */}
      <Section title="Acceso rápido">
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button
            onClick={() => navigate('/')}
            style={{ minHeight:52, padding:'14px 20px', background:G, color:'#fff', border:'none', borderRadius:8, fontWeight:800, fontSize:'1rem', cursor:'pointer', letterSpacing:'.01em', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            📋 Hacer nuevo pedido →
          </button>
          <button
            onClick={() => navigate('/')}
            style={{ minHeight:48, padding:'12px 20px', background:GBGR, color:G, border:`1.5px solid ${G2}`, borderRadius:8, fontWeight:700, fontSize:'.9rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            📄 Ver mi lista de precios
          </button>
          <a
            href="mailto:agroajua@gmail.com?subject=Consulta%20de%20cliente&body=Hola%20AJÚA%2C%20soy%20cliente%20y%20necesito%20ayuda%20con..."
            style={{ minHeight:48, padding:'12px 20px', background:'#fff', color:'#1565C0', border:'1.5px solid #BBDEFB', borderRadius:8, fontWeight:700, fontSize:'.9rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, textDecoration:'none' }}>
            ✉ Contactar a AJÚA
          </a>
        </div>
      </Section>

    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }) {
  const G = '#1B5E20';
  return (
    <div style={{ background:'#fff', borderRadius:8, padding:'14px 16px', border:'1.5px solid #E8F0E8', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
        <span>{icon}</span> {label}
      </div>
      <div style={{ fontWeight:900, fontSize:'1.15rem', color:color||G, lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontSize:'.72rem', color:'#888', marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, action }) {
  const G = '#1B5E20';
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontSize:'.72rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.09em', color:'#888' }}>{title}</div>
        {action && (
          <button onClick={action.onClick} style={{ background:'none', border:'none', color:G, fontWeight:700, fontSize:'.78rem', cursor:'pointer', padding:0 }}>
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
