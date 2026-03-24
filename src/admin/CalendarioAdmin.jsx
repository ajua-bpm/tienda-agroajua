import { useState, useMemo } from 'react';
import { useCollection } from '../hooks/useFirestore.js';
import { fmtDate, fmtQ, today } from '../utils/format.js';

const G = '#1A3D28';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

export default function CalendarioAdmin() {
  const { data: ordenes }  = useCollection('t_ordenes',  { limitN:1000 });
  const { data: clientes } = useCollection('t_clientes', { limitN:500 });

  const [view, setView]           = useState('mes'); // 'mes' | 'semana'
  const [mes, setMes]             = useState(() => { const d=new Date(); return { year:d.getFullYear(), month:d.getMonth() }; });
  const [semana, setSemana]       = useState(() => startOfWeek(new Date()));
  const [filtroCliente, setFiltroCliente] = useState('');
  const [modalOrden, setModalOrden] = useState(null);

  const todayStr = today();

  const clienteMap = useMemo(() => {
    const m = {};
    for (const c of clientes) m[c.id] = c;
    return m;
  }, [clientes]);

  // Build event map {dateStr: [{tipo, orden, clienteNombre}]}
  const events = useMemo(() => {
    const m = {};
    const add = (dateStr, tipo, orden) => {
      if (!dateStr) return;
      if (!m[dateStr]) m[dateStr] = [];
      const cid = orden.clienteId || orden.clienteUid;
      const clienteNombre = clienteMap[cid]?.nombre || orden.nombre || '—';
      if (filtroCliente && cid !== filtroCliente) return;
      m[dateStr].push({ tipo, orden, clienteNombre });
    };

    for (const o of ordenes) {
      // Delivery event
      if (o.fechaEntregaPromesada && !['cancelada','pagada'].includes(o.estado)) {
        add(o.fechaEntregaPromesada, 'entrega', o);
      }
      // Payment due event
      if (o.fechaPagoPromesada && ['entregada','facturada'].includes(o.estado)) {
        add(o.fechaPagoPromesada, 'pago', o);
      }
    }
    return m;
  }, [ordenes, clienteMap, filtroCliente]);

  // ── Month navigation ───────────────────────────────────────────────────────
  const prevMes = () => setMes(m => m.month===0?{year:m.year-1,month:11}:{year:m.year,month:m.month-1});
  const nextMes = () => setMes(m => m.month===11?{year:m.year+1,month:0}:{year:m.year,month:m.month+1});

  // ── Week navigation ────────────────────────────────────────────────────────
  const prevSemana = () => { const d=new Date(semana); d.setDate(d.getDate()-7); setSemana(d); };
  const nextSemana = () => { const d=new Date(semana); d.setDate(d.getDate()+7); setSemana(d); };

  // ── Build month grid ───────────────────────────────────────────────────────
  const monthCells = useMemo(() => {
    const diasEnMes = new Date(mes.year, mes.month+1, 0).getDate();
    const primerDia = new Date(mes.year, mes.month, 1).getDay();
    const cells = [];
    for (let i=0; i<primerDia; i++) cells.push(null);
    for (let d=1; d<=diasEnMes; d++) {
      const ds = `${mes.year}-${String(mes.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ d, ds, evs: events[ds]||[] });
    }
    return cells;
  }, [mes, events]);

  // ── Build week days ────────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const days = [];
    for (let i=0; i<7; i++) {
      const d = new Date(semana);
      d.setDate(d.getDate()+i);
      const ds = d.toISOString().slice(0,10);
      days.push({ d: d.getDate(), ds, dayName: DIAS[d.getDay()], evs: events[ds]||[] });
    }
    return days;
  }, [semana, events]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const hoy      = events[todayStr] || [];
    const entregas = hoy.filter(e => e.tipo==='entrega').length;
    const pagos    = hoy.filter(e => e.tipo==='pago').length;
    const venc     = Object.entries(events).filter(([ds]) => ds < todayStr)
      .flatMap(([, evs]) => evs.filter(e => e.tipo==='pago')).length;
    return { entregas, pagos, venc };
  }, [events, todayStr]);

  return (
    <div>
      <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:G, marginBottom:14 }}>Calendario</h1>

      {/* Stats strip */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <StatChip label="Entregas hoy" n={stats.entregas} color='#1565C0' bg='#E3F2FD' />
        <StatChip label="Pagos hoy"    n={stats.pagos}    color='#E65100' bg='#FFF3E0' />
        <StatChip label="Pagos vencidos" n={stats.venc} color='#C62828' bg='#FFEBEE' />
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        <div style={{ display:'flex', gap:0, borderRadius:6, overflow:'hidden', border:'1.5px solid #E0E0E0' }}>
          {['mes','semana'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding:'6px 16px', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:'.78rem', fontWeight:600, background:view===v?G:'#fff', color:view===v?'#fff':'#555' }}>
              {v==='mes'?'Mes':'Semana'}
            </button>
          ))}
        </div>

        {view==='mes' ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={prevMes} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color:'#888' }}>‹</button>
            <span style={{ fontWeight:700, fontSize:'.88rem', color:G, minWidth:140, textAlign:'center' }}>{MESES[mes.month]} {mes.year}</span>
            <button onClick={nextMes} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color:'#888' }}>›</button>
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={prevSemana} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color:'#888' }}>‹</button>
            <span style={{ fontWeight:700, fontSize:'.88rem', color:G, minWidth:180, textAlign:'center' }}>
              {semana.toLocaleDateString('es-GT')} – {weekDays[6]?.ds ? new Date(weekDays[6].ds+'T12:00').toLocaleDateString('es-GT') : ''}
            </span>
            <button onClick={nextSemana} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color:'#888' }}>›</button>
          </div>
        )}

        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
          style={{ padding:'6px 10px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.82rem', outline:'none', fontFamily:'inherit', maxWidth:200 }}>
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre||c.email}</option>)}
        </select>

        <button onClick={() => { setMes({year:new Date().getFullYear(),month:new Date().getMonth()}); setSemana(startOfWeek(new Date())); }}
          style={{ padding:'6px 14px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.78rem', fontWeight:600, background:'#fff', cursor:'pointer' }}>
          Hoy
        </button>
      </div>

      {/* ── Month view ──────────────────────────────────────────────────────── */}
      {view === 'mes' && (
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflow:'hidden' }}>
          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'2px solid #F0F0EC' }}>
            {DIAS.map(d => (
              <div key={d} style={{ padding:'8px 4px', textAlign:'center', fontSize:'.7rem', fontWeight:700, color:'#888', textTransform:'uppercase' }}>{d}</div>
            ))}
          </div>
          {/* Cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {monthCells.map((cell, i) => {
              if (!cell) return <div key={`e${i}`} style={{ borderRight:'1px solid #F0F0EC', borderBottom:'1px solid #F0F0EC', minHeight:90 }} />;
              const isToday = cell.ds === todayStr;
              const entregas = cell.evs.filter(e => e.tipo==='entrega');
              const pagos    = cell.evs.filter(e => e.tipo==='pago');
              const hayVenc  = pagos.some(() => cell.ds < todayStr);
              return (
                <div key={cell.ds}
                  style={{ borderRight:'1px solid #F0F0EC', borderBottom:'1px solid #F0F0EC', minHeight:90, padding:'4px 6px', background:isToday?'#E8F5E9':'#fff', cursor: cell.evs.length?'pointer':'' }}
                  onClick={() => cell.evs.length && setModalOrden({ ds: cell.ds, evs: cell.evs })}>
                  <div style={{ fontWeight:isToday?900:400, fontSize:'.8rem', marginBottom:4,
                    background:isToday?G:'transparent', color:isToday?'#fff':'#555',
                    borderRadius:isToday?'50%':'0', width:isToday?22:undefined, height:isToday?22:undefined,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>{cell.d}</div>
                  {entregas.map((ev, j) => (
                    <div key={j} style={{ fontSize:'.65rem', background:'#BBDEFB', color:'#0D47A1', borderRadius:3, padding:'2px 5px', marginBottom:2, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      🚚 {ev.clienteNombre}
                    </div>
                  ))}
                  {pagos.map((ev, j) => {
                    const v = ev.orden.fechaPagoPromesada < todayStr;
                    return (
                      <div key={j} style={{ fontSize:'.65rem', background:v?'#FFCDD2':'#FFE0B2', color:v?'#C62828':'#E65100', borderRadius:3, padding:'2px 5px', marginBottom:2, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        💰 {ev.clienteNombre}
                      </div>
                    );
                  })}
                  {hayVenc && <div style={{ fontSize:'.6rem', color:'#C62828', fontWeight:800 }}>⚠</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Week view ───────────────────────────────────────────────────────── */}
      {view === 'semana' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
          {weekDays.map(day => {
            const isToday  = day.ds === todayStr;
            const entregas = day.evs.filter(e => e.tipo==='entrega');
            const pagos    = day.evs.filter(e => e.tipo==='pago');
            return (
              <div key={day.ds} style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflow:'hidden', minHeight:160 }}>
                {/* Day header */}
                <div style={{ padding:'8px 10px', background:isToday?G:'#F5F5F0', borderBottom:'1px solid #F0F0EC' }}>
                  <div style={{ fontSize:'.7rem', fontWeight:700, color:isToday?'#F5F0E4':'#888', textTransform:'uppercase' }}>{day.dayName}</div>
                  <div style={{ fontWeight:900, fontSize:'1.1rem', color:isToday?'#fff':G }}>{day.d}</div>
                </div>
                {/* Events */}
                <div style={{ padding:'6px 8px' }}>
                  {entregas.map((ev, j) => (
                    <div key={j} onClick={() => setModalOrden({ ds:day.ds, evs:[ev] })}
                      style={{ fontSize:'.72rem', background:'#E3F2FD', color:'#1565C0', borderRadius:4, padding:'4px 7px', marginBottom:4, cursor:'pointer' }}>
                      <div style={{ fontWeight:700 }}>🚚 Entrega</div>
                      <div style={{ opacity:.8 }}>{ev.clienteNombre}</div>
                      <div style={{ opacity:.6 }}>{ev.orden.correlativo||'—'}</div>
                    </div>
                  ))}
                  {pagos.map((ev, j) => {
                    const v = ev.orden.fechaPagoPromesada < todayStr;
                    return (
                      <div key={j} onClick={() => setModalOrden({ ds:day.ds, evs:[ev] })}
                        style={{ fontSize:'.72rem', background:v?'#FFEBEE':'#FFF3E0', color:v?'#C62828':'#E65100', borderRadius:4, padding:'4px 7px', marginBottom:4, cursor:'pointer' }}>
                        <div style={{ fontWeight:700 }}>{v?'⚠ VENCIDO':'💰 Pago'}</div>
                        <div style={{ opacity:.8 }}>{ev.clienteNombre}</div>
                        <div style={{ opacity:.6 }}>{ev.orden.correlativo||'—'} · {fmtQ(ev.orden.total)}</div>
                      </div>
                    );
                  })}
                  {!day.evs.length && <div style={{ color:'#ccc', fontSize:'.72rem', textAlign:'center', paddingTop:16 }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ display:'flex', gap:14, marginTop:14, fontSize:'.75rem', flexWrap:'wrap' }}>
        <span><span style={{ background:'#BBDEFB', padding:'1px 6px', borderRadius:3, color:'#0D47A1', fontWeight:700 }}>🚚</span> Entrega programada</span>
        <span><span style={{ background:'#FFE0B2', padding:'1px 6px', borderRadius:3, color:'#E65100', fontWeight:700 }}>💰</span> Pago pendiente</span>
        <span><span style={{ background:'#FFCDD2', padding:'1px 6px', borderRadius:3, color:'#C62828', fontWeight:700 }}>⚠</span> Pago vencido</span>
      </div>

      {/* Detail modal */}
      {modalOrden && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}
          onClick={() => setModalOrden(null)}>
          <div style={{ background:'#fff', borderRadius:10, padding:24, width:380, maxHeight:'70vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontWeight:800, color:G }}>{fmtDate(modalOrden.ds)}</span>
              <button onClick={() => setModalOrden(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem', color:'#888' }}>✕</button>
            </div>
            {modalOrden.evs.map((ev, i) => {
              const v = ev.tipo==='pago' && ev.orden.fechaPagoPromesada < todayStr;
              return (
                <div key={i} style={{ background:ev.tipo==='entrega'?'#E3F2FD':v?'#FFEBEE':'#FFF3E0', borderRadius:6, padding:'12px 14px', marginBottom:8 }}>
                  <div style={{ fontWeight:700, color:ev.tipo==='entrega'?'#1565C0':v?'#C62828':'#E65100', marginBottom:6 }}>
                    {ev.tipo==='entrega'?'🚚 Entrega':v?'⚠ Pago VENCIDO':'💰 Pago pendiente'}
                  </div>
                  <DR label="Cliente"  value={ev.clienteNombre} />
                  <DR label="OC"       value={ev.orden.correlativo||'—'} />
                  <DR label="Total"    value={fmtQ(ev.orden.total)} />
                  {ev.orden.sucursalNombre && <DR label="Sucursal" value={ev.orden.sucursalNombre} />}
                  {ev.tipo==='pago' && ev.orden.numeroFEL && <DR label="FEL" value={ev.orden.numeroFEL} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, n, color, bg }) {
  return (
    <div style={{ background:bg, borderRadius:8, padding:'8px 16px', display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontWeight:900, fontSize:'1.3rem', color }}>{n}</span>
      <span style={{ fontSize:'.75rem', fontWeight:600, color:'#555' }}>{label}</span>
    </div>
  );
}

function DR({ label, value }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:3, fontSize:'.8rem' }}>
      <span style={{ fontWeight:700, color:'#888', minWidth:80, flexShrink:0 }}>{label}</span>
      <span style={{ color:'#1A1A18' }}>{value}</span>
    </div>
  );
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d;
}
