import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtQ, fmtDate, cap, today } from '../utils/format.js';
import Badge from '../components/Badge.jsx';

const G = '#1A3D28';
const thSt = { color:'#fff', padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', background: G };
const tdSt = { padding:'9px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0EC' };
const IS = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

const METODOS = ['Transferencia bancaria', 'Depósito', 'Efectivo', 'Cheque', 'Tarjeta', 'Otro'];

export default function AdminPagos() {
  const { data: ordenes } = useCollection('t_ordenes', { orderField: 'creadoEn', limitN: 500 });
  const { update: updateOrden } = useWrite('t_ordenes');
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [pagoForm, setPagoForm] = useState({ monto: '', metodo: 'Transferencia bancaria', referencia: '', fecha: today(), nota: '' });
  const [saving, setSaving] = useState(false);

  // Pending payment: not cancelled, not already fully paid
  const pendientes = useMemo(() =>
    ordenes.filter(o => o.estado !== 'cancelada' && o.pago?.estado !== 'pagado'),
    [ordenes]
  );
  const pagadas = useMemo(() =>
    ordenes.filter(o => o.pago?.estado === 'pagado'),
    [ordenes]
  );

  const registrarPago = async () => {
    if (!selected) return;
    const monto = parseFloat(pagoForm.monto);
    if (!monto || monto <= 0) { toast('Ingresá un monto válido', 'warn'); return; }
    if (!pagoForm.metodo) { toast('Seleccioná el método de pago', 'warn'); return; }
    setSaving(true);
    try {
      const pagosAnteriores = selected.pago?.pagos || [];
      const nuevoPago = { monto, metodo: pagoForm.metodo, referencia: pagoForm.referencia, fecha: pagoForm.fecha, nota: pagoForm.nota, registradoEn: new Date().toISOString() };
      const allPagos = [...pagosAnteriores, nuevoPago];
      const totalPagado = allPagos.reduce((s, p) => s + (p.monto || 0), 0);
      const estadoPago = totalPagado >= selected.total ? 'pagado' : 'parcial';
      const estadoOrden = estadoPago === 'pagado' ? 'pagada' : selected.estado;
      await updateOrden(selected.id, {
        estado: estadoOrden,
        pago: { estado: estadoPago, pagos: allPagos, totalPagado },
      });
      toast(`✓ Pago de ${fmtQ(monto)} registrado`);
      setSelected(null);
      setPagoForm(f => ({ ...f, monto: '', referencia: '', nota: '' }));
    } finally { setSaving(false); }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: G, marginBottom: 18 }}>Pagos</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>

        {/* Pending */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto' }}>
          <div style={{ padding: '14px 20px', fontWeight: 700, color: G, borderBottom: '1px solid #F0F0EC', display: 'flex', justifyContent: 'space-between' }}>
            Pagos pendientes ({pendientes.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['OC', 'Cliente', 'Total', 'Pagado', 'Saldo', 'Estado', 'Acción'].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr></thead>
            <tbody>
              {pendientes.map((o, i) => {
                const totalPagado = o.pago?.totalPagado || 0;
                const saldo = o.total - totalPagado;
                return (
                  <tr key={o.id} style={{ background: selected?.id === o.id ? '#E8F5E9' : i % 2 ? '#F9F9F6' : '#fff' }}>
                    <td style={{ ...tdSt, fontWeight:700, color:G }}>{o.correlativo}</td>
                    <td style={tdSt}>{o.nombre || o.empresa || '—'}</td>
                    <td style={{ ...tdSt, fontWeight:700 }}>{fmtQ(o.total)}</td>
                    <td style={{ ...tdSt, color:'#2D6645' }}>{fmtQ(totalPagado)}</td>
                    <td style={{ ...tdSt, fontWeight:700, color: saldo > 0 ? '#C62828' : '#1B5E20' }}>{fmtQ(saldo)}</td>
                    <td style={tdSt}><Badge label={cap(o.pago?.estado || 'pendiente')} bg={o.pago?.estado === 'parcial' ? '#FFF3E0' : '#FFEBEE'} color={o.pago?.estado === 'parcial' ? '#E65100' : '#C62828'} /></td>
                    <td style={tdSt}>
                      <button onClick={() => { setSelected(o); setPagoForm(f => ({ ...f, monto: String(saldo), fecha: today() })); }}
                        style={{ padding:'4px 12px', background:G, color:'#fff', border:'none', borderRadius:4, fontSize:'.72rem', cursor:'pointer', fontWeight:600 }}>
                        Registrar pago
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!pendientes.length && <tr><td colSpan={7} style={{ ...tdSt, textAlign:'center', color:'#888', padding:'30px' }}>Sin pagos pendientes</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Pago form modal-like inline */}
        {selected && (
          <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: 20, maxWidth: 480 }}>
            <div style={{ fontWeight: 700, color: G, marginBottom: 14 }}>Registrar pago — {selected.correlativo}</div>
            <div style={{ fontSize: '.82rem', color: '#555', marginBottom: 12 }}>
              Total: <strong>{fmtQ(selected.total)}</strong> · Saldo: <strong style={{ color: '#C62828' }}>{fmtQ(selected.total - (selected.pago?.totalPagado || 0))}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
                Monto (Q) *
                <input type="number" min="0" step="0.01" value={pagoForm.monto} onChange={e => setPagoForm(f => ({ ...f, monto: e.target.value }))} style={IS} />
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
                Fecha *
                <input type="date" value={pagoForm.fecha} onChange={e => setPagoForm(f => ({ ...f, fecha: e.target.value }))} style={IS} />
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10, gridColumn:'span 2' }}>
                Método *
                <select value={pagoForm.metodo} onChange={e => setPagoForm(f => ({ ...f, metodo: e.target.value }))} style={IS}>
                  {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10, gridColumn:'span 2' }}>
                No. referencia / boleta
                <input value={pagoForm.referencia} onChange={e => setPagoForm(f => ({ ...f, referencia: e.target.value }))} placeholder="Número de transferencia, boleta, etc." style={IS} />
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:14, gridColumn:'span 2' }}>
                Nota
                <textarea value={pagoForm.nota} onChange={e => setPagoForm(f => ({ ...f, nota: e.target.value }))} rows={2} style={{ ...IS, resize:'vertical' }} />
              </label>
            </div>
            {/* Payment history */}
            {(selected.pago?.pagos || []).length > 0 && (
              <div style={{ marginBottom: 14, background: '#F5F5F0', borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#888', marginBottom: 6 }}>Pagos anteriores</div>
                {(selected.pago?.pagos || []).map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: 4 }}>
                    <span>{fmtDate(p.fecha)} · {p.metodo}</span>
                    <span style={{ fontWeight: 700, color: '#2D6645' }}>{fmtQ(p.monto)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={registrarPago} disabled={saving} style={{ flex:1, padding:'10px', background: saving ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Guardando…' : '✓ Registrar pago'}
              </button>
              <button onClick={() => setSelected(null)} style={{ padding:'10px 14px', background:'#F5F5F5', border:'1px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', cursor:'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Paid history */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto' }}>
          <div style={{ padding: '14px 20px', fontWeight: 700, color: G, borderBottom: '1px solid #F0F0EC', fontSize: '.88rem' }}>
            Pagos completos ({pagadas.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['OC', 'Cliente', 'Total', 'Método último pago', 'Fecha'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr></thead>
            <tbody>
              {pagadas.slice(0, 50).map((o, i) => {
                const ultimo = (o.pago?.pagos || []).slice(-1)[0];
                return (
                  <tr key={o.id} style={{ background: i % 2 ? '#F9F9F6' : '#fff' }}>
                    <td style={{ ...tdSt, fontWeight:700, color:G }}>{o.correlativo}</td>
                    <td style={tdSt}>{o.nombre || o.empresa || '—'}</td>
                    <td style={{ ...tdSt, fontWeight:700, color:'#2D6645' }}>{fmtQ(o.total)}</td>
                    <td style={{ ...tdSt, color:'#888' }}>{ultimo?.metodo || '—'}</td>
                    <td style={{ ...tdSt, color:'#888' }}>{fmtDate(ultimo?.fecha)}</td>
                  </tr>
                );
              })}
              {!pagadas.length && <tr><td colSpan={5} style={{ ...tdSt, textAlign:'center', color:'#888', padding:'30px' }}>Sin pagos completados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
