import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtQ, fmtDate, estadoColor, ESTADOS_ORDEN, cap } from '../utils/format.js';
import Badge from '../components/Badge.jsx';

const G = '#1A3D28';
const thSt = { color:'#fff', padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', whiteSpace:'nowrap', background: G };
const tdSt = { padding:'9px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0EC' };

export default function AdminOrdenes() {
  const { data: ordenes, loading } = useCollection('t_ordenes', { orderField: 'creadoEn', limitN: 500 });
  const { update } = useWrite('t_ordenes');
  const toast = useToast();

  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda]         = useState('');
  const [selected, setSelected]         = useState(null);
  const [nota, setNota]                 = useState('');

  const filtradas = useMemo(() => {
    let list = ordenes;
    if (filtroEstado) list = list.filter(o => o.estado === filtroEstado);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(o =>
        o.correlativo?.toLowerCase().includes(q) ||
        o.nombre?.toLowerCase().includes(q) ||
        o.empresa?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [ordenes, filtroEstado, busqueda]);

  const cambiarEstado = async (id, estado) => {
    await update(id, { estado });
    toast(`Estado actualizado: ${cap(estado)}`);
    if (selected?.id === id) setSelected(o => ({ ...o, estado }));
  };

  const guardarNota = async () => {
    if (!selected || !nota.trim()) return;
    await update(selected.id, { notaAdmin: nota });
    toast('✓ Nota guardada');
  };

  const ESTADOS_AVANCE = ESTADOS_ORDEN.filter(e => e !== 'cancelada');

  return (
    <div>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: G, marginBottom: 18 }}>Órdenes / Pedidos ({ordenes.length})</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por OC, cliente..."
          style={{ padding: '8px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6, fontSize: '.82rem', outline: 'none', fontFamily: 'inherit', width: 240 }}
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6, fontSize: '.82rem', outline: 'none', fontFamily: 'inherit' }}>
          <option value="">Todos los estados</option>
          {ESTADOS_ORDEN.map(e => <option key={e} value={e}>{cap(e)}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start' }}>
        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['OC', 'Fecha', 'Cliente', 'Total', 'F.Entrega', 'Estado', 'Pago', 'Acción'].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ ...tdSt, textAlign:'center', color:'#888' }}>Cargando…</td></tr>}
              {!loading && filtradas.map((o, i) => {
                const { bg, color } = estadoColor(o.estado);
                const isSelected = selected?.id === o.id;
                return (
                  <tr key={o.id} style={{ background: isSelected ? '#E8F5E9' : i % 2 ? '#F9F9F6' : '#fff', cursor: 'pointer' }} onClick={() => setSelected(isSelected ? null : o)}>
                    <td style={{ ...tdSt, fontWeight: 700, color: G }}>{o.correlativo}</td>
                    <td style={{ ...tdSt, color: '#888', whiteSpace: 'nowrap' }}>{fmtDate(o.fecha)}</td>
                    <td style={tdSt}>{o.nombre || o.empresa || '—'}</td>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#2D6645' }}>{fmtQ(o.total)}</td>
                    <td style={{ ...tdSt, color: '#888', whiteSpace: 'nowrap' }}>{fmtDate(o.fechaEntrega)}</td>
                    <td style={tdSt}><Badge label={cap(o.estado)} bg={bg} color={color} /></td>
                    <td style={tdSt}><Badge label={cap(o.pago?.estado || 'pendiente')} bg={o.pago?.estado === 'pagado' ? '#E8F5E9' : '#FFF3E0'} color={o.pago?.estado === 'pagado' ? '#1B5E20' : '#E65100'} /></td>
                    <td style={tdSt}>
                      <select
                        value={o.estado}
                        onChange={e => { e.stopPropagation(); cambiarEstado(o.id, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        style={{ padding: '4px 8px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: '.75rem', fontFamily: 'inherit', cursor: 'pointer' }}
                      >
                        {ESTADOS_ORDEN.map(e => <option key={e} value={e}>{cap(e)}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {!loading && !filtradas.length && <tr><td colSpan={8} style={{ ...tdSt, textAlign:'center', color:'#888', padding:'40px' }}>Sin resultados</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: 20, position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 800, color: G, fontSize: '.95rem' }}>{selected.correlativo}</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#888' }}>✕</button>
            </div>

            <DetailRow label="Cliente" value={`${selected.nombre || '—'} · ${selected.empresa || ''}`} />
            <DetailRow label="NIT" value={selected.nit || 'CF'} />
            <DetailRow label="Teléfono" value={selected.telefono || '—'} />
            <DetailRow label="Email" value={selected.email || '—'} />
            <DetailRow label="Dirección" value={selected.direccion || '—'} />
            <DetailRow label="Fecha entrega" value={fmtDate(selected.fechaEntrega)} />
            <DetailRow label="Notas" value={selected.notas || '—'} />

            <div style={{ margin: '14px 0', borderTop: '1px solid #F0F0EC', paddingTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '.75rem', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>Items</div>
              {(selected.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: 4 }}>
                  <span>{item.nombre} × {item.cantidad} {item.unidad}</span>
                  <span style={{ fontWeight: 700, color: '#2D6645' }}>{fmtQ(item.subtotal)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0F0EC' }}>
                <span>Total</span>
                <span style={{ color: G }}>{fmtQ(selected.total)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>Nota interna</div>
              <textarea
                value={nota || selected.notaAdmin || ''}
                onChange={e => setNota(e.target.value)}
                rows={2}
                placeholder="Instrucciones internas, cambios, etc."
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0E0E0', borderRadius: 4, fontSize: '.82rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
              />
              <button onClick={guardarNota} style={{ marginTop: 4, padding: '6px 14px', background: G, color: '#fff', border: 'none', borderRadius: 4, fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' }}>
                Guardar nota
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ESTADOS_AVANCE.map(e => (
                <button key={e} onClick={() => cambiarEstado(selected.id, e)}
                  style={{ padding: '5px 12px', border: `1px solid ${estadoColor(e).color}`, borderRadius: 4, background: selected.estado === e ? estadoColor(e).bg : 'transparent', color: estadoColor(e).color, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
                  {cap(e)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: '.82rem' }}>
      <span style={{ fontWeight: 700, color: '#888', minWidth: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#1A1A18' }}>{value}</span>
    </div>
  );
}
