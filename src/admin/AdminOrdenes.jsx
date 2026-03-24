import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtDate, fmtQ, today, estadoColor, ESTADOS_ORDEN, cap } from '../utils/format.js';
import Badge from '../components/Badge.jsx';
import { notifyCambioEstado } from '../utils/mail.js';

const G = '#1A3D28';
const thSt = { color:'#fff', padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', whiteSpace:'nowrap', background:G };
const tdSt = { padding:'9px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0EC', verticalAlign:'middle' };
const IS   = { padding:'7px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.82rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };
const LS   = { display:'flex', flexDirection:'column', gap:3, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:10 };

// Pipeline order (excludes 'cancelada' from forward flow)
const PIPELINE = ['nueva','confirmada','preparando','en_ruta','entregada','facturada','pagada'];

// State transitions that require extra data
const ESTADO_REQUIERE = {
  entregada: { key:'fechaEntregaReal',   label:'Fecha de entrega real',    type:'date' },
  facturada: { key:'numeroFEL',          label:'Número FEL',               type:'text', extra: { key2:'fechaFactura', label2:'Fecha factura', type2:'date' } },
  pagada:    { key:'fechaPagoReal',      label:'Fecha de pago real',       type:'date' },
};

export default function AdminOrdenes() {
  const { data: ordenes, loading } = useCollection('t_ordenes', { orderField:'creadoEn', orderDir:'desc', limitN:500 });
  const { update } = useWrite('t_ordenes');
  const { data: clientes } = useCollection('t_clientes', { limitN:500 });
  const toast = useToast();

  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [busqueda, setBusqueda]           = useState('');
  const [fechaDesde, setFechaDesde]       = useState('');
  const [fechaHasta, setFechaHasta]       = useState('');
  const [selected, setSelected]           = useState(null);

  // Extra data modal
  const [modal, setModal]     = useState(null); // { ordenId, estado, field, value, field2, value2 }

  // Nota interna
  const [nota, setNota] = useState('');

  // Multiple selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  const clienteMap = useMemo(() => {
    const m = {};
    for (const c of clientes) m[c.id] = c;
    return m;
  }, [clientes]);

  const filtradas = useMemo(() => {
    let list = ordenes;
    if (filtroEstado)  list = list.filter(o => o.estado === filtroEstado);
    if (filtroCliente) list = list.filter(o => (o.clienteId||o.clienteUid) === filtroCliente);
    if (fechaDesde)    list = list.filter(o => (o.fechaOrden||o.fecha||'') >= fechaDesde);
    if (fechaHasta)    list = list.filter(o => (o.fechaOrden||o.fecha||'') <= fechaHasta);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(o =>
        o.correlativo?.toLowerCase().includes(q) ||
        o.nombre?.toLowerCase().includes(q)      ||
        o.empresa?.toLowerCase().includes(q)     ||
        o.numeroFEL?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [ordenes, filtroEstado, filtroCliente, busqueda, fechaDesde, fechaHasta]);

  // Count by state
  const countByEstado = useMemo(() => {
    const m = {};
    for (const o of ordenes) m[o.estado] = (m[o.estado]||0) + 1;
    return m;
  }, [ordenes]);

  // ── State change ───────────────────────────────────────────────────────────
  const iniciarCambioEstado = (orden, estado) => {
    const req = ESTADO_REQUIERE[estado];
    if (req) {
      setModal({ ordenId: orden.id, estado, field: req.key, label: req.label, type: req.type, value: '', field2: req.extra?.key2||null, label2: req.extra?.label2||null, type2: req.extra?.type2||null, value2: '' });
    } else {
      cambiarEstado(orden.id, estado, {});
    }
  };

  const cambiarEstado = async (id, estado, extra = {}) => {
    const updates = { estado, ...extra };

    // Auto-calculate fechaPagoPromesada when entregada
    if (estado === 'entregada' && extra.fechaEntregaReal) {
      const orden = ordenes.find(o => o.id === id);
      const cid   = orden?.clienteId || orden?.clienteUid;
      const cli   = clienteMap[cid];
      const dias  = cli?.diasCredito || 0;
      if (dias > 0) {
        const d = new Date(extra.fechaEntregaReal);
        d.setDate(d.getDate() + dias);
        updates.fechaPagoPromesada = d.toISOString().slice(0,10);
      }
    }

    await update(id, updates);
    toast(`Estado: ${cap(estado)}`);
    const orden = ordenes.find(o => o.id === id);
    if (orden) notifyCambioEstado({ ...orden, ...updates }, estado);
    if (selected?.id === id) setSelected(o => ({ ...o, ...updates }));
    setModal(null);
  };

  const confirmarModal = () => {
    if (!modal.value && modal.type === 'date') { toast('Ingresá la fecha', 'warn'); return; }
    if (!modal.value && modal.type === 'text') { toast('Ingresá el número FEL', 'warn'); return; }
    const extra = { [modal.field]: modal.value };
    if (modal.field2 && modal.value2) extra[modal.field2] = modal.value2;
    cambiarEstado(modal.ordenId, modal.estado, extra);
  };

  const guardarNota = async () => {
    if (!selected || !nota.trim()) return;
    await update(selected.id, { notaAdmin: nota });
    toast('✓ Nota guardada');
  };

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const toggleSelect = id => setSelectedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const bulkConfirmar = async () => {
    if (!selectedIds.size) return;
    const proms = [...selectedIds].map(id => cambiarEstado(id, 'confirmada', {}));
    await Promise.all(proms);
    setSelectedIds(new Set());
    toast(`✓ ${selectedIds.size} órdenes confirmadas`);
  };

  return (
    <div>
      <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:G, marginBottom:14 }}>
        Órdenes / Pedidos ({ordenes.length})
      </h1>

      {/* Pipeline summary */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {PIPELINE.map(e => {
          const { bg, color } = estadoColor(e);
          const n = countByEstado[e] || 0;
          return (
            <button key={e} onClick={() => setFiltroEstado(filtroEstado===e?'':e)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, border:`2px solid ${filtroEstado===e?color:'transparent'}`, background:filtroEstado===e?bg:'#F5F5F0', cursor:'pointer', transition:'all .1s' }}>
              <span style={{ fontWeight:800, fontSize:'.75rem', color }}>{n}</span>
              <span style={{ fontSize:'.72rem', fontWeight:600, color:'#555' }}>{cap(e)}</span>
            </button>
          );
        })}
        {filtroEstado && <button onClick={() => setFiltroEstado('')} style={{ fontSize:'.72rem', color:'#888', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Limpiar filtro</button>}
      </div>

      {/* Filters row */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="OC, cliente, FEL…"
          style={{ padding:'7px 12px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.82rem', outline:'none', fontFamily:'inherit', width:200 }} />
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
          style={{ padding:'7px 12px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.82rem', outline:'none', fontFamily:'inherit', maxWidth:200 }}>
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre||c.email}</option>)}
        </select>
        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
          style={{ padding:'7px 10px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.82rem', outline:'none', fontFamily:'inherit' }} />
        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
          style={{ padding:'7px 10px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.82rem', outline:'none', fontFamily:'inherit' }} />
        {selectedIds.size > 0 && (
          <button onClick={bulkConfirmar}
            style={{ padding:'7px 14px', background:G, color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:'.78rem', cursor:'pointer' }}>
            Confirmar {selectedIds.size} sel.
          </button>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:selected?'1fr 400px':'1fr', gap:20, alignItems:'start' }}>

        {/* Table */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              <th style={{ ...thSt, width:32 }}></th>
              {['OC','Fecha','Cliente','Total','Entrega','Estado','Pago','Acción'].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ ...tdSt, textAlign:'center', color:'#888' }}>Cargando…</td></tr>}
              {!loading && filtradas.map((o, i) => {
                const { bg, color } = estadoColor(o.estado);
                const isSelected = selected?.id === o.id;
                const vencida = o.fechaPagoPromesada && o.fechaPagoPromesada < today() && !['pagada','cancelada'].includes(o.estado);
                return (
                  <tr key={o.id}
                    style={{ background:isSelected?'#E8F5E9':i%2?'#F9F9F6':'#fff', cursor:'pointer' }}
                    onClick={() => { setSelected(isSelected?null:o); setNota(''); }}>
                    <td style={{ ...tdSt, padding:'9px 8px' }} onClick={e => { e.stopPropagation(); toggleSelect(o.id); }}>
                      <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => {}} style={{ cursor:'pointer' }} />
                    </td>
                    <td style={{ ...tdSt, fontWeight:700, color:G, whiteSpace:'nowrap' }}>{o.correlativo||'—'}</td>
                    <td style={{ ...tdSt, color:'#888', whiteSpace:'nowrap' }}>{fmtDate(o.fechaOrden||o.fecha)}</td>
                    <td style={tdSt}>
                      <div style={{ fontWeight:600, fontSize:'.83rem' }}>{o.nombre||o.empresa||'—'}</div>
                      {o.sucursalNombre && <div style={{ fontSize:'.7rem', color:'#4A9E6A' }}>{o.sucursalNombre}</div>}
                    </td>
                    <td style={{ ...tdSt, fontWeight:700, color:'#2D6645', whiteSpace:'nowrap' }}>{fmtQ(o.total)}</td>
                    <td style={{ ...tdSt, color:'#888', whiteSpace:'nowrap' }}>
                      {fmtDate(o.fechaEntregaPromesada||o.fechaEntrega)}
                    </td>
                    <td style={tdSt}><Badge label={cap(o.estado)} bg={bg} color={color} /></td>
                    <td style={tdSt}>
                      {vencida
                        ? <span style={{ fontSize:'.7rem', fontWeight:700, color:'#C62828' }}>⚠ VENCIDO</span>
                        : o.estado==='pagada'
                          ? <span style={{ fontSize:'.7rem', color:'#1B5E20', fontWeight:700 }}>✓ Pagado</span>
                          : o.fechaPagoPromesada
                            ? <span style={{ fontSize:'.7rem', color:'#888' }}>Vence {fmtDate(o.fechaPagoPromesada)}</span>
                            : <span style={{ fontSize:'.7rem', color:'#ccc' }}>—</span>
                      }
                    </td>
                    <td style={{ ...tdSt, padding:'9px 8px' }} onClick={e => e.stopPropagation()}>
                      <select value={o.estado} onChange={e => iniciarCambioEstado(o, e.target.value)}
                        style={{ padding:'4px 6px', border:'1px solid #E0E0E0', borderRadius:4, fontSize:'.73rem', fontFamily:'inherit', cursor:'pointer', maxWidth:110 }}>
                        {ESTADOS_ORDEN.map(e => <option key={e} value={e}>{cap(e)}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {!loading && !filtradas.length && (
                <tr><td colSpan={9} style={{ ...tdSt, textAlign:'center', color:'#888', padding:40 }}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && <OrdenDetalle orden={selected} onClose={() => setSelected(null)}
          nota={nota} setNota={setNota} onGuardarNota={guardarNota}
          onCambiarEstado={iniciarCambioEstado} />}
      </div>

      {/* Extra-data modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ background:'#fff', borderRadius:10, padding:28, width:360, boxShadow:'0 8px 40px rgba(0,0,0,.25)' }}>
            <div style={{ fontWeight:800, color:G, fontSize:'.95rem', marginBottom:14 }}>
              Cambiar a: <span style={{ ...estadoColor(modal.estado) }}>{cap(modal.estado)}</span>
            </div>
            <label style={LS}>{modal.label}
              <input type={modal.type} value={modal.value} onChange={e => setModal(m => ({ ...m, value:e.target.value }))} style={IS} placeholder={modal.type==='text'?'Ej. FEL-2026-0001':''} />
            </label>
            {modal.field2 && (
              <label style={LS}>{modal.label2}
                <input type={modal.type2} value={modal.value2} onChange={e => setModal(m => ({ ...m, value2:e.target.value }))} style={IS} />
              </label>
            )}
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button onClick={confirmarModal}
                style={{ flex:1, padding:'10px', background:G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, cursor:'pointer' }}>
                Confirmar
              </button>
              <button onClick={() => setModal(null)}
                style={{ flex:1, padding:'10px', background:'transparent', color:'#555', border:'1.5px solid #E0E0E0', borderRadius:4, fontWeight:600, cursor:'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────────
function OrdenDetalle({ orden, onClose, nota, setNota, onGuardarNota, onCambiarEstado }) {
  const estIdx = PIPELINE.indexOf(orden.estado);

  return (
    <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', position:'sticky', top:24, maxHeight:'85vh', overflowY:'auto' }}>
      {/* Header */}
      <div style={{ background:G, color:'#F5F0E4', padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'8px 8px 0 0' }}>
        <div>
          <div style={{ fontWeight:800, fontSize:'.92rem' }}>{orden.correlativo||'—'}</div>
          <div style={{ fontSize:'.72rem', opacity:.7 }}>{fmtDate(orden.fechaOrden||orden.fecha)}</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#F5F0E4', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
      </div>

      {/* Pipeline visual */}
      <div style={{ padding:'12px 16px 8px', overflowX:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:0, minWidth:340 }}>
          {PIPELINE.map((e, i) => {
            const done    = i <= estIdx;
            const current = i === estIdx;
            const { color } = estadoColor(e);
            return (
              <div key={e} style={{ display:'flex', alignItems:'center', flex:1 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <div style={{
                    width:22, height:22, borderRadius:'50%',
                    background: done?(current?color:'#4A9E6A'):'#E0E0E0',
                    border: current?`2px solid ${color}`:'2px solid transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'.6rem', color:'#fff', fontWeight:800,
                  }}>{done&&!current?'✓':i+1}</div>
                  <div style={{ fontSize:'.55rem', color:done?'#333':'#aaa', fontWeight:current?800:400, textAlign:'center', whiteSpace:'nowrap' }}>
                    {cap(e)}
                  </div>
                </div>
                {i < PIPELINE.length-1 && (
                  <div style={{ flex:1, height:2, background: i<estIdx?'#4A9E6A':'#E0E0E0', margin:'0 1px 12px' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding:'0 16px 16px' }}>
        {/* Client info */}
        <div style={{ background:'#F5F5F0', borderRadius:6, padding:'10px 12px', marginBottom:12 }}>
          <DR label="Cliente"  value={`${orden.nombre||'—'}${orden.empresa?` · ${orden.empresa}`:''}`} />
          {orden.sucursalNombre && <DR label="Sucursal" value={orden.sucursalNombre} />}
          <DR label="NIT"     value={orden.nit||'CF'} />
          {orden.telefono && <DR label="Tel"     value={orden.telefono} />}
          {orden.email    && <DR label="Email"   value={orden.email} />}
        </div>

        {/* Dates */}
        <div style={{ background:'#F5F5F0', borderRadius:6, padding:'10px 12px', marginBottom:12 }}>
          <DR label="F. Entrega prometida" value={fmtDate(orden.fechaEntregaPromesada||orden.fechaEntrega)} />
          {orden.fechaEntregaReal   && <DR label="F. Entrega real"   value={fmtDate(orden.fechaEntregaReal)} />}
          {orden.fechaFactura       && <DR label="F. Factura"        value={fmtDate(orden.fechaFactura)} />}
          {orden.numeroFEL          && <DR label="No. FEL"           value={orden.numeroFEL} />}
          {orden.fechaPagoPromesada && <DR label="Pago prometido"    value={fmtDate(orden.fechaPagoPromesada)} />}
          {orden.fechaPagoReal      && <DR label="Pago real"         value={fmtDate(orden.fechaPagoReal)} />}
        </div>

        {/* Items */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:6 }}>Items</div>
          {(orden.items||[]).map((item, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'.82rem', marginBottom:4, padding:'4px 0', borderBottom:'1px solid #F5F5F0' }}>
              <span style={{ color:'#333' }}>{item.descripcion||item.nombre} × <strong>{item.cantidad}</strong> {item.unidad||''}</span>
              <span style={{ fontWeight:700, color:'#2D6645', whiteSpace:'nowrap' }}>{fmtQ(item.subtotal)}</span>
            </div>
          ))}
          <div style={{ marginTop:8, borderTop:'2px solid #F0F0EC', paddingTop:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.8rem', color:'#888', marginBottom:2 }}>
              <span>Subtotal neto</span><span>{fmtQ((orden.total||0)/1.12)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.8rem', color:'#888', marginBottom:2 }}>
              <span>IVA 12%</span><span>{fmtQ((orden.total||0) - (orden.total||0)/1.12)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:'.92rem' }}>
              <span>Total</span><span style={{ color:G }}>{fmtQ(orden.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {orden.notas && (
          <div style={{ background:'#FFF9C4', borderRadius:4, padding:'8px 10px', fontSize:'.8rem', color:'#555', marginBottom:10 }}>
            <strong>Nota cliente:</strong> {orden.notas}
          </div>
        )}

        {/* Internal note */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:4 }}>Nota interna</div>
          <textarea value={nota||orden.notaAdmin||''} onChange={e => setNota(e.target.value)}
            rows={2} placeholder="Instrucciones internas, cambios, etc."
            style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.82rem', fontFamily:'inherit', resize:'vertical', outline:'none', boxSizing:'border-box' }} />
          <button onClick={onGuardarNota}
            style={{ marginTop:4, padding:'5px 14px', background:G, color:'#fff', border:'none', borderRadius:4, fontSize:'.73rem', fontWeight:600, cursor:'pointer' }}>
            Guardar nota
          </button>
        </div>

        {/* State buttons */}
        <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:6 }}>Cambiar estado</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {ESTADOS_ORDEN.map(e => {
            const { bg, color } = estadoColor(e);
            return (
              <button key={e} onClick={() => onCambiarEstado(orden, e)}
                style={{ padding:'5px 11px', border:`1.5px solid ${color}`, borderRadius:4,
                  background:orden.estado===e?bg:'transparent', color, fontSize:'.72rem',
                  fontWeight:600, cursor:'pointer' }}>
                {cap(e)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DR({ label, value }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:4, fontSize:'.8rem' }}>
      <span style={{ fontWeight:700, color:'#888', minWidth:130, flexShrink:0 }}>{label}</span>
      <span style={{ color:'#1A1A18' }}>{value}</span>
    </div>
  );
}
