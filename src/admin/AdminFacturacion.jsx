import { useState, useRef } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { storage, ref, uploadBytes, getDownloadURL } from '../firebase.js';
import { nextFacturaCorrelativo } from '../utils/correlativo.js';
import { fmtQ, fmtDate, cap, today } from '../utils/format.js';
import Badge from '../components/Badge.jsx';

const G = '#1A3D28';
const thSt = { color:'#fff', padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', background: G };
const tdSt = { padding:'9px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0EC' };
const IS = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

export default function AdminFacturacion() {
  const { data: ordenes } = useCollection('t_ordenes', { orderField: 'creadoEn', limitN: 500 });
  const { update: updateOrden } = useWrite('t_ordenes');
  const toast  = useToast();
  const xmlRef = useRef();

  const [selected, setSelected] = useState(null);
  const [felForm, setFelForm] = useState({ serie: 'A', uuid: '', emisor: 'AGROINDUSTRIA AJUA', fechaEmision: today(), nota: '' });
  const [uploading, setUploading] = useState(false);
  const [xmlUrl, setXmlUrl] = useState('');

  // Orders that have been delivered but not yet invoiced
  const porFacturar = ordenes.filter(o => o.estado === 'entregada' && o.factura?.estado !== 'emitida');
  const facturadas  = ordenes.filter(o => o.factura?.estado === 'emitida');

  const handleXmlUpload = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `t_facturas/xml/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setXmlUrl(url);
      toast('✓ XML subido');
    } catch { toast('Error al subir XML', 'error'); }
    finally { setUploading(false); }
  };

  const emitirFactura = async () => {
    if (!selected) return;
    const correlativo = await nextFacturaCorrelativo(felForm.serie);
    await updateOrden(selected.id, {
      estado: 'facturada',
      factura: {
        estado:       'emitida',
        correlativo,
        serie:        felForm.serie,
        uuid:         felForm.uuid,
        emisor:       felForm.emisor,
        fechaEmision: felForm.fechaEmision,
        montoTotal:   selected.total,
        xmlUrl:       xmlUrl || null,
        nota:         felForm.nota,
      },
    });
    toast(`✓ Factura ${correlativo} emitida`);
    setSelected(null);
    setXmlUrl('');
    setFelForm(f => ({ ...f, uuid: '', nota: '' }));
  };

  const anularFactura = async (o) => {
    if (!window.confirm(`¿Anular factura ${o.factura?.correlativo}?`)) return;
    await updateOrden(o.id, { estado: 'entregada', factura: { ...o.factura, estado: 'anulada' } });
    toast('Factura anulada');
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: G, marginBottom: 18 }}>Facturación</h1>

      {/* FEL info panel */}
      <div style={{ background: '#E8F5E9', border: '1px solid #4A9E6A', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: '.82rem', color: G }}>
        <strong>🧾 Sobre FEL Guatemala:</strong> Podés subir el XML del documento tributario electrónico emitido por tu certificador SAT,
        o registrar manualmente el UUID y correlativo. La estructura queda lista para conectar con un certificador (Infile, G4S, Megaprint u otro) en el futuro.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Por facturar */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: 20 }}>
          <div style={{ fontWeight: 700, color: G, marginBottom: 12, fontSize: '.88rem' }}>
            Por facturar ({porFacturar.length})
          </div>
          {porFacturar.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#888', fontSize: '.83rem' }}>Sin pendientes de facturación</div>
          ) : porFacturar.map(o => (
            <div key={o.id} style={{ padding: '10px 0', borderBottom: '1px solid #F0F0EC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: G }}>{o.correlativo}</div>
                <div style={{ fontSize: '.75rem', color: '#888' }}>{o.nombre || o.empresa} · {fmtDate(o.fecha)}</div>
                <div style={{ fontSize: '.75rem', color: '#888' }}>NIT: {o.nit || 'CF'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#2D6645' }}>{fmtQ(o.total)}</div>
                <button onClick={() => { setSelected(o); setXmlUrl(''); }} style={{ marginTop: 4, padding: '4px 12px', background: G, color: '#fff', border: 'none', borderRadius: 4, fontSize: '.72rem', cursor: 'pointer', fontWeight: 600 }}>
                  Facturar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Emit form */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: 20 }}>
          {selected ? (
            <>
              <div style={{ fontWeight: 700, color: G, marginBottom: 14, fontSize: '.88rem' }}>
                Emitir factura para {selected.correlativo}
              </div>
              <div style={{ fontSize: '.82rem', color: '#555', marginBottom: 12 }}>
                <div><strong>Cliente:</strong> {selected.nombre || selected.empresa}</div>
                <div><strong>NIT:</strong> {selected.nit || 'CF'}</div>
                <div><strong>Total:</strong> {fmtQ(selected.total)}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
                  Serie FEL
                  <input value={felForm.serie} onChange={e => setFelForm(f => ({ ...f, serie: e.target.value }))} placeholder="A" style={IS} />
                </label>
                <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
                  Fecha emisión
                  <input type="date" value={felForm.fechaEmision} onChange={e => setFelForm(f => ({ ...f, fechaEmision: e.target.value }))} style={IS} />
                </label>
              </div>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
                UUID / Autorización SAT
                <input value={felForm.uuid} onChange={e => setFelForm(f => ({ ...f, uuid: e.target.value }))} placeholder="UUID del DTE (opcional si subís XML)" style={IS} />
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
                Emisor
                <input value={felForm.emisor} onChange={e => setFelForm(f => ({ ...f, emisor: e.target.value }))} style={IS} />
              </label>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>XML FEL (opcional)</div>
                <input type="file" accept=".xml" ref={xmlRef} onChange={handleXmlUpload} style={{ fontSize: '.78rem' }} />
                {uploading && <div style={{ fontSize: '.72rem', color: '#888', marginTop: 4 }}>Subiendo XML…</div>}
                {xmlUrl && <div style={{ fontSize: '.72rem', color: '#1B5E20', marginTop: 4 }}>✓ XML subido</div>}
              </div>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:14 }}>
                Nota
                <textarea value={felForm.nota} onChange={e => setFelForm(f => ({ ...f, nota: e.target.value }))} rows={2} style={{ ...IS, resize:'vertical' }} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={emitirFactura} style={{ flex:1, padding:'10px', background:G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor:'pointer' }}>
                  ✓ Emitir factura
                </button>
                <button onClick={() => setSelected(null)} style={{ padding:'10px 14px', background:'#F5F5F5', border:'1px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', cursor:'pointer' }}>
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888', fontSize: '.83rem' }}>
              Seleccioná un pedido de la lista para facturar
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto' }}>
        <div style={{ padding: '16px 20px', fontWeight: 700, color: G, borderBottom: '1px solid #F0F0EC', fontSize: '.88rem' }}>
          Facturas emitidas ({facturadas.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['OC', 'Factura', 'UUID', 'Fecha', 'Cliente', 'NIT', 'Total', 'XML', 'Acciones'].map(h => <th key={h} style={thSt}>{h}</th>)}
          </tr></thead>
          <tbody>
            {facturadas.map((o, i) => (
              <tr key={o.id} style={{ background: i % 2 ? '#F9F9F6' : '#fff' }}>
                <td style={{ ...tdSt, fontWeight:700, color:G }}>{o.correlativo}</td>
                <td style={{ ...tdSt, fontWeight:700 }}>{o.factura?.correlativo || '—'}</td>
                <td style={{ ...tdSt, color:'#888', fontSize:'.75rem', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={o.factura?.uuid}>{o.factura?.uuid || '—'}</td>
                <td style={{ ...tdSt, color:'#888', whiteSpace:'nowrap' }}>{fmtDate(o.factura?.fechaEmision)}</td>
                <td style={tdSt}>{o.nombre || o.empresa || '—'}</td>
                <td style={{ ...tdSt, color:'#888' }}>{o.nit || 'CF'}</td>
                <td style={{ ...tdSt, fontWeight:700, color:'#2D6645' }}>{fmtQ(o.total)}</td>
                <td style={tdSt}>
                  {o.factura?.xmlUrl
                    ? <a href={o.factura.xmlUrl} target="_blank" rel="noreferrer" style={{ color:'#4A9E6A', fontSize:'.78rem', fontWeight:600 }}>📄 XML</a>
                    : <span style={{ color:'#ccc' }}>—</span>}
                </td>
                <td style={tdSt}>
                  <button onClick={() => anularFactura(o)} style={{ padding:'3px 10px', background:'#FFEBEE', color:'#C62828', border:'none', borderRadius:4, fontSize:'.7rem', cursor:'pointer', fontWeight:600 }}>
                    Anular
                  </button>
                </td>
              </tr>
            ))}
            {!facturadas.length && <tr><td colSpan={9} style={{ ...tdSt, textAlign:'center', color:'#888', padding:'30px' }}>Sin facturas emitidas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
