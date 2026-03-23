import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtDate, TIER_LABEL, TIER_COLOR, cap } from '../utils/format.js';
import Badge from '../components/Badge.jsx';

const G = '#1A3D28';
const thSt = { color:'#fff', padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', background: G };
const tdSt = { padding:'9px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0EC' };

export default function AdminClientes() {
  const { data: clientes, loading } = useCollection('t_clientes', { orderField: 'nombre', limitN: 500 });
  const { data: listas }            = useCollection('t_listas', { orderField: 'nombre', limitN: 50 });
  const { update } = useWrite('t_clientes');
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    if (!busqueda) return clientes;
    const q = busqueda.toLowerCase();
    return clientes.filter(c => c.nombre?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.empresa?.toLowerCase().includes(q));
  }, [clientes, busqueda]);

  const cambiarTier = async (id, tier) => {
    const listaId = tier === 'negociado' ? '' : tier;
    await update(id, { tier, listaId: listaId || 'general' });
    toast(`Tier actualizado: ${TIER_LABEL[tier]}`);
  };

  const cambiarLista = async (id, listaId) => {
    await update(id, { listaId });
    toast('Lista de precio asignada');
  };

  const toggleActivo = async (c) => {
    await update(c.id, { activo: !c.activo });
    toast(c.activo ? 'Cliente desactivado' : 'Cliente activado');
  };

  const setAdmin = async (c) => {
    const nuevoRol = c.rol === 'admin' ? '' : 'admin';
    await update(c.id, { rol: nuevoRol });
    toast(nuevoRol === 'admin' ? '✓ Ahora es administrador' : 'Permisos de admin removidos');
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: G, marginBottom: 18 }}>Clientes ({clientes.length})</h1>

      <input
        value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, email o empresa..."
        style={{ padding: '9px 14px', border: '1.5px solid #E0E0E0', borderRadius: 6, fontSize: '.83rem', outline: 'none', fontFamily: 'inherit', width: 300, marginBottom: 16 }}
      />

      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Nombre', 'Email', 'Empresa', 'Teléfono', 'Tier', 'Lista de Precio', 'Estado', 'Registro', 'Acciones'].map(h => <th key={h} style={thSt}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ ...tdSt, textAlign:'center', color:'#888' }}>Cargando…</td></tr>}
            {filtrados.map((c, i) => {
              const { bg, color } = TIER_COLOR[c.tier] || {};
              return (
                <tr key={c.id} style={{ background: i % 2 ? '#F9F9F6' : '#fff' }}>
                  <td style={tdSt}>
                    <div style={{ fontWeight: 700 }}>{c.nombre || '—'}</div>
                    {c.rol === 'admin' && <span style={{ fontSize: '.65rem', background: '#E8F5E9', color: '#1B5E20', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>ADMIN</span>}
                  </td>
                  <td style={{ ...tdSt, color: '#888' }}>{c.email || '—'}</td>
                  <td style={{ ...tdSt, color: '#888' }}>{c.empresa || '—'}</td>
                  <td style={{ ...tdSt, color: '#888' }}>{c.telefono || '—'}</td>
                  <td style={tdSt}>
                    <select value={c.tier || 'general'} onChange={e => cambiarTier(c.id, e.target.value)}
                      style={{ padding: '3px 8px', border: `1px solid ${color || '#E0E0E0'}`, borderRadius: 4, fontSize: '.75rem', fontFamily: 'inherit', background: bg || '#F5F5F5', color: color || '#555', cursor: 'pointer' }}>
                      {Object.entries(TIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td style={tdSt}>
                    <select value={c.listaId || 'general'} onChange={e => cambiarLista(c.id, e.target.value)}
                      style={{ padding: '3px 8px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: '.75rem', fontFamily: 'inherit', cursor: 'pointer' }}>
                      <option value="general">General</option>
                      {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </td>
                  <td style={tdSt}>
                    <button onClick={() => toggleActivo(c)} style={{ padding: '3px 10px', border: '1px solid', borderRadius: 4, fontSize: '.7rem', fontWeight: 700, cursor: 'pointer', borderColor: c.activo ? '#1B5E20' : '#ccc', background: c.activo ? '#E8F5E9' : '#F5F5F5', color: c.activo ? '#1B5E20' : '#888' }}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td style={{ ...tdSt, color: '#888', fontSize: '.75rem', whiteSpace: 'nowrap' }}>
                    {c.creadoEn?.toDate ? fmtDate(c.creadoEn.toDate().toISOString().slice(0, 10)) : '—'}
                  </td>
                  <td style={tdSt}>
                    <button onClick={() => setAdmin(c)} style={{ padding: '3px 10px', background: c.rol === 'admin' ? '#FFF3E0' : '#F5F5F5', color: c.rol === 'admin' ? '#E65100' : '#888', border: 'none', borderRadius: 4, fontSize: '.7rem', cursor: 'pointer', fontWeight: 600 }}>
                      {c.rol === 'admin' ? 'Quitar admin' : '+ Admin'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && !filtrados.length && <tr><td colSpan={9} style={{ ...tdSt, textAlign:'center', color:'#888', padding:'40px' }}>Sin clientes registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
