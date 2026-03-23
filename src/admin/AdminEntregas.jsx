import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtQ, fmtDate, estadoColor, cap, today } from '../utils/format.js';
import Badge from '../components/Badge.jsx';

const G = '#1A3D28';
const thSt = { color:'#fff', padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', background: G };
const tdSt = { padding:'9px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0EC' };
const IS = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

// Estados de entrega
const ESTADOS_ENT = ['pendiente', 'asignada', 'en_ruta', 'entregada', 'fallida'];

export default function AdminEntregas() {
  const { data: ordenes } = useCollection('t_ordenes', { orderField: 'fechaEntrega', limitN: 500 });
  const { update: updateOrden } = useWrite('t_ordenes');
  const toast = useToast();
  const [filtroFecha, setFiltroFecha] = useState(today());
  const [selected, setSelected] = useState(null);
  const [entForm, setEntForm] = useState({ transportista: '', rutaId: '', notaEntrega: '' });

  // Filter orders that need delivery (not cancelled, not paid off — just pending delivery)
  const pendientes = useMemo(() =>
    ordenes.filter(o => o.estado !== 'cancelada' && o.estado !== 'nueva'),
    [ordenes]
  );

  const filtradas = useMemo(() => {
    if (!filtroFecha) return pendientes;
    return pendientes.filter(o => o.fechaEntrega === filtroFecha);
  }, [pendientes, filtroFecha]);

  const asignarEntrega = async () => {
    if (!selected) return;
    if (!entForm.transportista) { toast('Ingresá el transportista', 'warn'); return; }
    await updateOrden(selected.id, {
      estado: 'en_ruta',
      entrega: {
        ...selected.entrega,
        transportista: entForm.transportista,
        rutaId:        entForm.rutaId,
        notaEntrega:   entForm.notaEntrega,
        estado:        'en_ruta',
        fechaAsignada: today(),
      },
    });
    toast(`✓ Entrega asignada a ${entForm.transportista}`);
    setSelected(null);
  };

  const confirmarEntrega = async (o) => {
    const fechaReal = today();
    await updateOrden(o.id, {
      estado: 'entregada',
      entrega: { ...o.entrega, estado: 'entregada', fechaReal },
    });
    toast('✓ Entrega confirmada');
  };

  const reportarFalla = async (o, motivo) => {
    await updateOrden(o.id, {
      estado: 'confirmada', // Return to confirmed so it can be rescheduled
      entrega: { ...o.entrega, estado: 'fallida', motivoFalla: motivo, fechaFalla: today() },
    });
    toast('Falla de entrega registrada');
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: G, marginBottom: 18 }}>Entregas</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <label style={{ fontSize: '.75rem', fontWeight: 700, color: '#555', display: 'flex', alignItems: 'center', gap: 8 }}>
          Fecha entrega:
          <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}
            style={{ padding: '7px 10px', border: '1.5px solid #E0E0E0', borderRadius: 4, fontSize: '.83rem', outline: 'none', fontFamily: 'inherit' }} />
        </label>
        <button onClick={() => setFiltroFecha('')} style={{ padding: '7px 14px', background: '#F5F5F5', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: '.78rem', cursor: 'pointer' }}>
          Ver todas
        </button>
        <span style={{ fontSize: '.82rem', color: '#888' }}>{filtradas.length} pedido{filtradas.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['OC', 'Cliente', 'Dirección', 'F.Entrega', 'Total', 'Est.Orden', 'Transportista', 'Acciones'].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtradas.map((o, i) => {
                const { bg, color } = estadoColor(o.estado);
                return (
                  <tr key={o.id} style={{ background: i % 2 ? '#F9F9F6' : '#fff' }}>
                    <td style={{ ...tdSt, fontWeight: 700, color: G }}>{o.correlativo}</td>
                    <td style={tdSt}>{o.nombre || o.empresa || '—'}</td>
                    <td style={{ ...tdSt, color: '#888', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.direccion || '—'}</td>
                    <td style={{ ...tdSt, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDate(o.fechaEntrega)}</td>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#2D6645' }}>{fmtQ(o.total)}</td>
                    <td style={tdSt}><Badge label={cap(o.estado)} bg={bg} color={color} /></td>
                    <td style={{ ...tdSt, color: '#888' }}>{o.entrega?.transportista || '—'}</td>
                    <td style={tdSt}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setSelected(o); setEntForm({ transportista: o.entrega?.transportista || '', rutaId: o.entrega?.rutaId || '', notaEntrega: o.entrega?.notaEntrega || '' }); }}
                          style={{ padding: '4px 10px', background: '#E3F2FD', color: '#1565C0', border: 'none', borderRadius: 4, fontSize: '.72rem', cursor: 'pointer', fontWeight: 600 }}>Asignar</button>
                        {o.estado === 'en_ruta' && (
                          <button onClick={() => confirmarEntrega(o)} style={{ padding: '4px 10px', background: '#E8F5E9', color: '#1B5E20', border: 'none', borderRadius: 4, fontSize: '.72rem', cursor: 'pointer', fontWeight: 600 }}>✓ Entregado</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtradas.length && <tr><td colSpan={8} style={{ ...tdSt, textAlign:'center', color:'#888', padding:'40px' }}>Sin entregas para esta fecha</td></tr>}
            </tbody>
          </table>
        </div>

        {selected && (
          <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: 20, position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 800, color: G }}>{selected.correlativo}</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#888' }}>✕</button>
            </div>
            <div style={{ fontSize: '.82rem', color: '#555', marginBottom: 14 }}>
              <div><strong>Cliente:</strong> {selected.nombre || selected.empresa}</div>
              <div><strong>Dirección:</strong> {selected.direccion}</div>
              <div><strong>Entrega:</strong> {fmtDate(selected.fechaEntrega)}</div>
              <div><strong>Notas:</strong> {selected.notas || '—'}</div>
            </div>
            <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
              Transportista *
              <input value={entForm.transportista} onChange={e => setEntForm(f => ({ ...f, transportista: e.target.value }))} placeholder="Nombre del conductor" style={IS} />
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
              Ruta / Placa
              <input value={entForm.rutaId} onChange={e => setEntForm(f => ({ ...f, rutaId: e.target.value }))} placeholder="Ej. GT-001 / P-123ABC" style={IS} />
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:14 }}>
              Nota de entrega
              <textarea value={entForm.notaEntrega} onChange={e => setEntForm(f => ({ ...f, notaEntrega: e.target.value }))} rows={2} placeholder="Instrucciones, horario..." style={{ ...IS, resize:'vertical' }} />
            </label>
            <button onClick={asignarEntrega} style={{ width: '100%', padding: '10px', background: G, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '.83rem', cursor: 'pointer' }}>
              🚚 Asignar entrega
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
