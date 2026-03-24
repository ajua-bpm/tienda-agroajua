import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, collection, query, where, onSnapshot } from '../../firebase.js';
import { fmtQ, fmtDate, today } from '../../utils/format.js';

const G      = '#1B5E20';
const ACTIVOS = ['solicitada','nueva','confirmada','preparando','en_ruta'];
const PIPE    = ['solicitada','confirmada','en_ruta','entregada','facturada','pagada'];
const pipeIdx = e => { const i = PIPE.indexOf(e); return i >= 0 ? i : (ACTIVOS.includes(e) ? 1 : -1); };
const eCo     = { solicitada:'#1565C0', nueva:'#1565C0', confirmada:'#33691E',
                  preparando:'#E65100', en_ruta:'#F57F17', entregada:'#2E7D32',
                  facturada:'#0D47A1', pagada:'#1B5E20', cancelada:'#C62828' };

export default function DashboardCliente() {
  const { user, cliente } = useAuth();
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 't_ordenes'), where('clienteUid', '==', user.uid));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.creadoEn?.seconds ?? 0) - (a.creadoEn?.seconds ?? 0));
      setOrdenes(docs);
    });
  }, [user]);

  const stats = useMemo(() => {
    const activos  = ordenes.filter(o => ACTIVOS.includes(o.estado)).length;
    const enCamino = ordenes.filter(o => o.estado === 'en_ruta').length;
    const pendPago = ordenes.filter(o => ['entregada','facturada'].includes(o.estado) && o.pago?.estado !== 'pagado');
    const saldo    = pendPago.reduce((s, o) => s + (o.total || 0), 0);
    const proxFecha = pendPago.map(o => o.fechaPagoPromesada).filter(Boolean).sort()[0] ?? null;
    return { activos, enCamino, saldo, proxFecha };
  }, [ordenes]);

  const hoy      = today();
  const recientes = ordenes.slice(0, 5);
  const nombre1  = cliente?.nombre?.split(' ')[0] || '';

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '1.22rem', fontWeight: 900, color: G }}>
          Bienvenido{nombre1 ? `, ${nombre1}` : ''}
        </div>
        {cliente?.empresa && <div style={{ fontSize: '.82rem', color: '#888', marginTop: 2 }}>{cliente.empresa}</div>}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard icon="📦" label="Pedidos activos" value={stats.activos}         col={G} />
        <StatCard icon="🚛" label="En camino"        value={stats.enCamino}        col="#F57F17" />
        <StatCard icon="💰" label="Saldo pendiente"  value={fmtQ(stats.saldo)}     col="#C62828" />
        <StatCard icon="📅" label="Próximo pago"
          value={stats.proxFecha ? fmtDate(stats.proxFecha) : '—'}
          col={stats.proxFecha && stats.proxFecha <= hoy ? '#C62828' : '#555'}
          sub={stats.proxFecha && stats.proxFecha <= hoy ? '⚠ Vencido' : ''} />
      </div>

      {/* Pedidos recientes */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F0EDE6' }}>
          <div style={{ fontWeight: 700, color: G, fontSize: '.9rem' }}>Pedidos recientes</div>
          <button onClick={() => navigate('/cuenta/pedidos')}
            style={{ background: 'none', border: 'none', color: G, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer' }}>
            Ver todos →
          </button>
        </div>

        {recientes.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#aaa', fontSize: '.85rem' }}>
            Sin pedidos aún.{' '}
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: G, fontWeight: 700, cursor: 'pointer' }}>
              Hacer el primero →
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAF7' }}>
                {['#OC','Fecha','Total','Estado','Pipeline'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#888', textAlign: 'left', borderBottom: '1px solid #F0EDE6' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recientes.map((o, i) => {
                const idx = pipeIdx(o.estado);
                const col = eCo[o.estado] || '#555';
                return (
                  <tr key={o.id} style={{ background: i % 2 ? '#FAFAF7' : '#fff', cursor: 'pointer' }}
                    onClick={() => navigate(`/cuenta/pedido/${o.id}`)}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: G, fontSize: '.85rem' }}>{o.correlativo || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '.8rem', color: '#666' }}>{fmtDate(o.fecha)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{fmtQ(o.total)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: col + '22', color: col, padding: '3px 9px', borderRadius: 4, fontSize: '.72rem', fontWeight: 700 }}>
                        {o.estado || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {PIPE.map((_, pi) => (
                          <div key={pi} style={{ width: 8, height: 8, borderRadius: '50%', background: pi <= idx ? G : '#DDD' }} />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Acceso rápido */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/')}
          style={{ padding: '12px 24px', background: G, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '.88rem', cursor: 'pointer' }}>
          🛒 Hacer pedido
        </button>
        <button onClick={() => navigate('/cuenta/calendario')}
          style={{ padding: '12px 24px', background: '#fff', color: G, border: `1.5px solid ${G}`, borderRadius: 8, fontWeight: 600, fontSize: '.88rem', cursor: 'pointer' }}>
          📅 Ver calendario
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, col, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,.07)' }}>
      <div style={{ fontSize: '.68rem', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: col }}>{value}</div>
      {sub && <div style={{ fontSize: '.7rem', color: col, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}
