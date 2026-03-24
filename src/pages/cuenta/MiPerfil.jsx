/**
 * MiPerfil — 4 tabs: Mi información | Mis pedidos | Cuenta financiera | Calendario
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, collection, query, where, onSnapshot, orderBy } from '../../firebase.js';
import { fmtQ, fmtDate, today } from '../../utils/format.js';
import MisOrdenes from './MisOrdenes.jsx';

const G = '#1A3D28';
const IS = { padding:'9px 12px', border:'1.5px solid #E0E0E0', borderRadius:5, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:3, boxSizing:'border-box' };
const LS = { display:'flex', flexDirection:'column', gap:3, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:12 };

export default function MiPerfil() {
  const { cliente, logout } = useAuth();
  const [tab, setTab] = useState('info');
  const [ordenes, setOrdenes] = useState([]);

  useEffect(() => {
    if (!cliente) return;
    const q = query(
      collection(db, 't_ordenes'),
      where('clienteUid', '==', cliente.id),
      orderBy('creadoEn', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setOrdenes(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, [cliente]);

  const saldoInfo = useMemo(() => {
    const pendientes = ordenes.filter(o => ['entregada','facturada'].includes(o.estado));
    const saldo      = pendientes.reduce((s,o) => s+(o.total||0), 0);
    const saldoVenc  = pendientes.filter(o => o.fechaPagoPromesada && o.fechaPagoPromesada < today()).reduce((s,o) => s+(o.total||0), 0);
    const proxima    = [...pendientes].sort((a,b) => (a.fechaPagoPromesada||'z').localeCompare(b.fechaPagoPromesada||'z'))[0];
    return { saldo, saldoVenc, proxima, pendientes };
  }, [ordenes]);

  const calData = useMemo(() => {
    const evs = {};
    for (const o of ordenes) {
      if (o.fechaEntregaPromesada && !['cancelada','pagada'].includes(o.estado)) {
        if (!evs[o.fechaEntregaPromesada]) evs[o.fechaEntregaPromesada] = [];
        evs[o.fechaEntregaPromesada].push({ tipo:'entrega', o });
      }
      if (o.fechaPagoPromesada && ['entregada','facturada'].includes(o.estado)) {
        if (!evs[o.fechaPagoPromesada]) evs[o.fechaPagoPromesada] = [];
        evs[o.fechaPagoPromesada].push({ tipo:'pago', o });
      }
    }
    return evs;
  }, [ordenes]);

  const sucursales = cliente?.sucursales || [];

  const TABS = [
    ['info',    'Mi información'],
    ['pedidos', 'Mis pedidos'],
    ['cuenta',  'Mi cuenta'],
    ['cal',     'Calendario'],
  ];

  return (
    <div>
      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #F0F0EC', marginBottom:24 }}>
        {TABS.map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding:'10px 20px', border:'none', cursor:'pointer', fontFamily:'inherit',
              fontSize:'.8rem', fontWeight:700,
              background: tab===t?'#fff':'transparent',
              color: tab===t?G:'#888',
              borderBottom: tab===t?`2px solid ${G}`:'2px solid transparent',
              marginBottom:-2,
            }}>{l}
          </button>
        ))}
      </div>

      {/* ── TAB INFO ── */}
      {tab === 'info' && (
        <div style={{ maxWidth:600 }}>
          <Section title="Mi empresa">
            <Row label="Nombre"   value={cliente?.nombre   || '—'} />
            <Row label="Empresa"  value={cliente?.empresa  || '—'} />
            <Row label="NIT"      value={cliente?.nit      || 'CF'} />
            <Row label="Teléfono" value={cliente?.telefono || '—'} />
            <Row label="Email"    value={cliente?.email    || '—'} />
            <Row label="Tipo"     value={cliente?.tipo==='negocio'?'Empresa / Negocio':'Persona natural'} />
            {cliente?.tipoNegocio && <Row label="Tipo negocio" value={cliente.tipoNegocio} />}
          </Section>

          {cliente?.diasCredito > 0 && (
            <Section title="Condiciones comerciales">
              <Row label="Días de crédito" value={`${cliente.diasCredito} días desde entrega`} />
              <Row label="Lista de precios" value={cliente?.listaId==='general'?'Lista general':'Lista especial asignada'} />
            </Section>
          )}

          <Section title={`Puntos de entrega (${sucursales.length})`}>
            {!sucursales.length && <div style={{ color:'#aaa', fontSize:'.85rem' }}>Sin sucursales registradas</div>}
            {sucursales.map(s => (
              <div key={s.id} style={{ background:'#F5F5F0', borderRadius:6, padding:'10px 14px', marginBottom:8 }}>
                <div style={{ fontWeight:700, color:G, fontSize:'.85rem' }}>{s.nombre}</div>
                {s.contacto && <div style={{ fontSize:'.8rem', color:'#555', marginTop:3 }}>{s.contacto}{s.telefono?` · ${s.telefono}`:''}</div>}
                {s.direccion && <div style={{ fontSize:'.78rem', color:'#888', marginTop:2 }}>{s.direccion}</div>}
                {s.activa===false && <span style={{ fontSize:'.68rem', color:'#C62828', fontWeight:700 }}>Inactiva</span>}
              </div>
            ))}
            <div style={{ marginTop:12, padding:'10px 14px', background:'#E8F5E9', borderRadius:6, fontSize:'.8rem', color:'#1B5E20' }}>
              Para modificar tu información o sucursales, contactá a tu ejecutivo AJÚA.<br />
              <strong>agroajua@gmail.com</strong>
            </div>
          </Section>

          <button onClick={logout}
            style={{ marginTop:8, padding:'9px 20px', background:'transparent', color:'#C62828', border:'1.5px solid #C62828', borderRadius:5, fontWeight:700, fontSize:'.85rem', cursor:'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      )}

      {/* ── TAB PEDIDOS ── */}
      {tab === 'pedidos' && <MisOrdenes />}

      {/* ── TAB CUENTA FINANCIERA ── */}
      {tab === 'cuenta' && (
        <div style={{ maxWidth:600 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
            <StatCard label="Saldo pendiente" value={fmtQ(saldoInfo.saldo)} color={saldoInfo.saldo>0?'#E65100':G} />
            <StatCard label="Saldo vencido"   value={fmtQ(saldoInfo.saldoVenc)} color={saldoInfo.saldoVenc>0?'#C62828':G} />
            <StatCard label="Total pedidos"   value={ordenes.length} />
            <StatCard label="Crédito"         value={cliente?.diasCredito===0?'Contado':`${cliente?.diasCredito||0} días`} />
          </div>

          {saldoInfo.proxima && (
            <div style={{ background:'#FFF3E0', border:'1px solid #FFB74D', borderRadius:8, padding:'14px 18px', marginBottom:20 }}>
              <div style={{ fontWeight:700, color:'#E65100', marginBottom:4 }}>Próximo pago</div>
              <div style={{ fontSize:'.9rem', fontWeight:700, color:'#1A1A18' }}>{fmtQ(saldoInfo.proxima.total)}</div>
              <div style={{ fontSize:'.8rem', color:'#888', marginTop:3 }}>
                {saldoInfo.proxima.correlativo} · vence {fmtDate(saldoInfo.proxima.fechaPagoPromesada)}
              </div>
            </div>
          )}

          <Section title="Saldo pendiente de pago">
            {!saldoInfo.pendientes.length && <div style={{ color:'#aaa', fontSize:'.85rem' }}>Sin saldo pendiente ✓</div>}
            {saldoInfo.pendientes.map(o => {
              const venc = o.fechaPagoPromesada && o.fechaPagoPromesada < today();
              return (
                <div key={o.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #F5F5F0', fontSize:'.85rem' }}>
                  <div>
                    <span style={{ fontWeight:700, color:G }}>{o.correlativo}</span>
                    {o.fechaPagoPromesada && <span style={{ color:venc?'#C62828':'#888', marginLeft:10 }}>vence {fmtDate(o.fechaPagoPromesada)}{venc?' ⚠':''}</span>}
                  </div>
                  <span style={{ fontWeight:700, color:venc?'#C62828':G }}>{fmtQ(o.total)}</span>
                </div>
              );
            })}
          </Section>

          <Section title="Facturas pagadas">
            {!ordenes.filter(o => o.estado==='pagada').length && <div style={{ color:'#aaa', fontSize:'.85rem' }}>Sin pagos registrados</div>}
            {ordenes.filter(o => o.estado==='pagada').slice(0,10).map(o => (
              <div key={o.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F5F5F0', fontSize:'.83rem' }}>
                <div>
                  <span style={{ fontWeight:700, color:G }}>{o.correlativo}</span>
                  {o.numeroFEL && <span style={{ color:'#888', marginLeft:8, fontSize:'.75rem' }}>FEL: {o.numeroFEL}</span>}
                  {o.fechaPagoReal && <span style={{ color:'#888', marginLeft:8 }}>{fmtDate(o.fechaPagoReal)}</span>}
                </div>
                <span style={{ fontWeight:700, color:'#1B5E20' }}>{fmtQ(o.total)}</span>
              </div>
            ))}
          </Section>

          <div style={{ padding:'12px 16px', background:'#E8F5E9', borderRadius:6, fontSize:'.8rem', color:'#1B5E20' }}>
            Para consultas de facturación: <strong>agroajua@gmail.com</strong>
          </div>
        </div>
      )}

      {/* ── TAB CALENDARIO ── */}
      {tab === 'cal' && <CalendarioCliente events={calData} />}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'#888', marginBottom:10 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display:'flex', gap:12, padding:'8px 0', borderBottom:'1px solid #F5F5F0', fontSize:'.85rem' }}>
      <span style={{ fontWeight:600, color:'#888', minWidth:130, flexShrink:0 }}>{label}</span>
      <span style={{ color:'#1A1A18' }}>{value}</span>
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

function CalendarioCliente({ events }) {
  const [mes, setMes] = useState(() => { const d=new Date(); return { year:d.getFullYear(), month:d.getMonth() }; });
  const diasEnMes = new Date(mes.year, mes.month+1, 0).getDate();
  const primerDia = new Date(mes.year, mes.month, 1).getDay();
  const todayStr  = new Date().toISOString().slice(0,10);
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const prevMes = () => setMes(m => m.month===0?{year:m.year-1,month:11}:{year:m.year,month:m.month-1});
  const nextMes = () => setMes(m => m.month===11?{year:m.year+1,month:0}:{year:m.year,month:m.month+1});
  const cells = [];
  for (let i=0; i<primerDia; i++) cells.push(null);
  for (let d=1; d<=diasEnMes; d++) {
    const ds = `${mes.year}-${String(mes.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({ d, ds, evs: events[ds]||[] });
  }
  return (
    <div style={{ maxWidth:600 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <button onClick={prevMes} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.3rem', color:'#888' }}>‹</button>
        <span style={{ fontWeight:800, fontSize:'1rem', color:G }}>{MESES[mes.month]} {mes.year}</span>
        <button onClick={nextMes} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.3rem', color:'#888' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:6 }}>
        {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:'.68rem', fontWeight:700, color:'#888' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} />;
          const isToday = cell.ds===todayStr;
          const hasEnt  = cell.evs.some(e => e.tipo==='entrega');
          const hasPago = cell.evs.some(e => e.tipo==='pago');
          const venc    = cell.evs.some(e => e.tipo==='pago' && cell.ds < todayStr);
          return (
            <div key={cell.ds} style={{ minHeight:44, padding:'4px 5px', borderRadius:6, background:isToday?'#E8F5E9':'#F9F9F6', border:isToday?`2px solid ${G}`:'1px solid #EFEFEF' }}>
              <div style={{ fontSize:'.75rem', fontWeight:isToday?900:400, color:isToday?G:'#555', textAlign:'center' }}>{cell.d}</div>
              {hasEnt  && <div style={{ fontSize:'.58rem', background:'#BBDEFB', borderRadius:3, padding:'1px 3px', marginTop:2, color:'#0D47A1', fontWeight:700, textAlign:'center' }}>ENT</div>}
              {hasPago && <div style={{ fontSize:'.58rem', background:venc?'#FFCDD2':'#FFE0B2', borderRadius:3, padding:'1px 3px', marginTop:2, color:venc?'#C62828':'#E65100', fontWeight:700, textAlign:'center' }}>PAGO{venc?' ⚠':''}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:14, marginTop:14, fontSize:'.75rem', flexWrap:'wrap' }}>
        <span><span style={{ background:'#BBDEFB', padding:'1px 6px', borderRadius:3, color:'#0D47A1', fontWeight:700 }}>ENT</span> Entrega programada</span>
        <span><span style={{ background:'#FFE0B2', padding:'1px 6px', borderRadius:3, color:'#E65100', fontWeight:700 }}>PAGO</span> Pago pendiente</span>
        <span><span style={{ background:'#FFCDD2', padding:'1px 6px', borderRadius:3, color:'#C62828', fontWeight:700 }}>PAGO ⚠</span> Vencido</span>
      </div>
    </div>
  );
}
