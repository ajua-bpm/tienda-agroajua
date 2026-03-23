import { useEffect, useState } from 'react';
import { db, collection, query, where, orderBy, onSnapshot } from '../../firebase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { fmtQ, fmtDate, estadoColor, ESTADOS_ORDEN, cap } from '../../utils/format.js';
import Badge from '../../components/Badge.jsx';

const G = '#1A3D28';

export default function MisOrdenes() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 't_ordenes'),
      where('clienteUid', '==', user.uid),
      orderBy('creadoEn', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  if (loading) return <div style={{ padding: 24, color: '#6B8070' }}>Cargando pedidos…</div>;

  if (!ordenes.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B8070' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
      <p>Aún no tenés pedidos registrados.</p>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: G, marginBottom: 18 }}>Mis pedidos ({ordenes.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ordenes.map(o => {
          const { bg, color } = estadoColor(o.estado);
          return (
            <div key={o.id} style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 8, padding: 16, cursor: 'pointer' }} onClick={() => setSelected(selected?.id === o.id ? null : o)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 800, color: G, fontSize: '.95rem' }}>{o.correlativo}</span>
                  <span style={{ color: '#6B8070', fontSize: '.8rem', marginLeft: 10 }}>Entrega: {fmtDate(o.fechaEntrega)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge label={cap(o.estado)} bg={bg} color={color} />
                  <span style={{ fontWeight: 800, color: G }}>{fmtQ(o.total)}</span>
                </div>
              </div>
              {/* Expanded detail */}
              {selected?.id === o.id && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F0EBE0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                    <thead>
                      <tr style={{ background: '#F5F0E4' }}>
                        {['Producto', 'Unidad', 'Cant.', 'Precio', 'Subtotal'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Producto' ? 'left' : 'right', fontWeight: 600, color: '#555' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(o.items || []).map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F0EBE0' }}>
                          <td style={{ padding: '7px 10px', fontWeight: 600 }}>{item.nombre}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6B8070' }}>{item.unidad}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right' }}>{item.cantidad}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right' }}>{fmtQ(item.precio)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#2D6645' }}>{fmtQ(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14, fontSize: '.8rem', color: '#555' }}>
                    <InfoChip label="Entrega" value={o.direccion} />
                    <InfoChip label="Notas" value={o.notas || '—'} />
                    <InfoChip label="Factura" value={o.factura?.correlativo || 'Pendiente'} />
                    <InfoChip label="Pago" value={cap(o.pago?.estado || 'pendiente')} />
                    <InfoChip label="Transportista" value={o.entrega?.transportista || '—'} />
                    <InfoChip label="Fecha real entrega" value={fmtDate(o.entrega?.fechaReal) || '—'} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div style={{ background: '#F5F0E4', borderRadius: 4, padding: '7px 10px' }}>
      <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6B8070', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '.82rem', color: '#1A3D28', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
