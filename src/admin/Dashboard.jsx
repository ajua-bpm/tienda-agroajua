import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../hooks/useFirestore.js';
import { fmtQ, fmtDate, estadoColor, cap } from '../utils/format.js';
import Badge from '../components/Badge.jsx';

const G = '#1A3D28';

function Metric({ label, value, sub, accent, to }) {
  const el = (
    <div style={{ background: '#fff', borderRadius: 8, padding: 18, borderTop: `3px solid ${accent || G}`, boxShadow: '0 1px 4px rgba(0,0,0,.06)', minWidth: 150 }}>
      <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#888', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: accent || G, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '.72rem', color: '#888', marginTop: 4 }}>{sub}</div>}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{el}</Link> : el;
}

export default function Dashboard() {
  const { data: ordenes }   = useCollection('t_ordenes',   { orderField: 'fecha',  orderDir: 'desc', limitN: 500 });
  const { data: productos }  = useCollection('t_productos', { orderField: 'nombre',  limitN: 300 });
  const { data: clientes }   = useCollection('t_clientes',  { limitN: 300 });

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const hoy       = ordenes.filter(o => o.fecha === today);
    const nuevas    = ordenes.filter(o => o.estado === 'nueva');
    const pendPago  = ordenes.filter(o => o.pago?.estado === 'pendiente' && o.estado !== 'cancelada' && o.estado !== 'nueva');
    const totalMes  = ordenes.filter(o => o.fecha?.startsWith(today.slice(0, 7))).reduce((s, o) => s + (o.total || 0), 0);
    return { hoy: hoy.length, nuevas: nuevas.length, pendPago: pendPago.length, totalMes };
  }, [ordenes, today]);

  const recientes = ordenes.slice(0, 8);

  return (
    <div>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: G, marginBottom: 20 }}>Dashboard</h1>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <Metric label="Pedidos hoy"       value={stats.hoy}     accent="#1565C0" to="/admin/ordenes" />
        <Metric label="Nuevos por aprobar" value={stats.nuevas}  accent="#E65100" to="/admin/ordenes" />
        <Metric label="Pagos pendientes"  value={stats.pendPago} accent="#C62828" to="/admin/pagos" />
        <Metric label="Ventas este mes"   value={fmtQ(stats.totalMes, 0)} accent={G} />
        <Metric label="Productos activos" value={productos.filter(p => p.activo !== false).length} to="/admin/productos" />
        <Metric label="Clientes"          value={clientes.length} to="/admin/clientes" />
      </div>

      {/* Recent orders */}
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: G, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          Pedidos recientes
          <Link to="/admin/ordenes" style={{ fontSize: '.75rem', color: '#4A9E6A', textDecoration: 'none' }}>Ver todos →</Link>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: G }}>
              {['Correlativo', 'Fecha', 'Cliente', 'Total', 'Entrega', 'Estado', ''].map(h => (
                <th key={h} style={{ color: '#fff', padding: '8px 12px', fontSize: '.7rem', fontWeight: 700, textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recientes.map((o, i) => {
              const { bg, color } = estadoColor(o.estado);
              return (
                <tr key={o.id} style={{ background: i % 2 ? '#F9F9F6' : '#fff', borderBottom: '1px solid #F0F0EC' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, fontSize: '.83rem', color: G }}>{o.correlativo}</td>
                  <td style={{ padding: '9px 12px', fontSize: '.83rem', color: '#888' }}>{fmtDate(o.fecha)}</td>
                  <td style={{ padding: '9px 12px', fontSize: '.83rem' }}>{o.nombre || o.empresa || '—'}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 700, fontSize: '.83rem', color: '#2D6645' }}>{fmtQ(o.total)}</td>
                  <td style={{ padding: '9px 12px', fontSize: '.83rem', color: '#888' }}>{fmtDate(o.fechaEntrega)}</td>
                  <td style={{ padding: '9px 12px' }}><Badge label={cap(o.estado)} bg={bg} color={color} /></td>
                  <td style={{ padding: '9px 12px' }}>
                    <Link to={`/admin/ordenes?id=${o.id}`} style={{ fontSize: '.72rem', color: '#4A9E6A', textDecoration: 'none', fontWeight: 600 }}>Ver</Link>
                  </td>
                </tr>
              );
            })}
            {!recientes.length && (
              <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#888', fontSize: '.83rem' }}>Sin pedidos aún</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
