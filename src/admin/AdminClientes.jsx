import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtDate, fmtQ, TIER_LABEL, TIER_COLOR } from '../utils/format.js';
import Badge from '../components/Badge.jsx';

const G = '#1A3D28';
const thSt = { color:'#fff', padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', background: G };
const tdSt = { padding:'9px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0EC', verticalAlign:'middle' };
const IS   = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };
const LS   = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:12 };

export default function AdminClientes() {
  const { data: clientes, loading } = useCollection('t_clientes', { limitN: 500 });
  const { data: listas }            = useCollection('t_listas', { orderField: 'nombre', limitN: 50 });
  const { data: ordenes }           = useCollection('t_ordenes', { orderField: 'fecha', orderDir: 'desc', limitN: 1000 });
  const { update } = useWrite('t_clientes');
  const toast = useToast();

  const [busqueda, setBusqueda] = useState('');
  const [filtroTier, setFiltroTier] = useState('');
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Order count per client
  const ordenesMap = useMemo(() => {
    const m = {};
    for (const o of ordenes) {
      if (o.clienteUid) m[o.clienteUid] = (m[o.clienteUid] || 0) + 1;
    }
    return m;
  }, [ordenes]);

  const filtrados = useMemo(() => {
    let list = clientes;
    if (filtroTier) list = list.filter(c => c.tier === filtroTier);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(c =>
        c.nombre?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.empresa?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [clientes, busqueda, filtroTier]);

  const openDetail = c => {
    setSelected(c);
    setEditForm({
      nombre:   c.nombre   || '',
      empresa:  c.empresa  || '',
      telefono: c.telefono || '',
      nit:      c.nit      || '',
      tier:     c.tier     || 'general',
      listaId:  c.listaId  || 'general',
      activo:   c.activo !== false,
      rol:      c.rol      || '',
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await update(selected.id, editForm);
      toast('✓ Cliente actualizado');
      setSelected(s => ({ ...s, ...editForm }));
    } catch { toast('Error al guardar', 'error'); }
    finally { setSaving(false); }
  };

  const ef = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  // Client orders
  const clientOrdenes = useMemo(() =>
    selected ? ordenes.filter(o => o.clienteUid === selected.id).slice(0, 10) : [],
    [ordenes, selected]
  );

  return (
    <div>
      <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:G, marginBottom:18 }}>
        Clientes ({clientes.length})
      </h1>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        <input
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar nombre, email, empresa..."
          style={{ padding:'8px 12px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:260 }}
        />
        <select value={filtroTier} onChange={e => setFiltroTier(e.target.value)}
          style={{ padding:'8px 12px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.83rem', outline:'none', fontFamily:'inherit' }}>
          <option value="">Todos los tiers</option>
          {Object.entries(TIER_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ fontSize:'.8rem', color:'#888' }}>{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap:20, alignItems:'start' }}>

        {/* Table */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Nombre / Email','Empresa','Tier','Lista de Precio','Pedidos','Estado',''].map(h =>
                <th key={h} style={thSt}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ ...tdSt, textAlign:'center', color:'#888' }}>Cargando…</td></tr>}
              {filtrados.map((c, i) => {
                const { bg, color } = TIER_COLOR[c.tier] || {};
                const nOrdenes = ordenesMap[c.id] || 0;
                const listaLabel = c.listaId === 'general' ? 'General'
                  : listas.find(l => l.id === c.listaId)?.nombre || c.listaId || 'General';
                return (
                  <tr key={c.id}
                    onClick={() => openDetail(c)}
                    style={{ background: selected?.id === c.id ? '#E8F5E9' : i % 2 ? '#F9F9F6' : '#fff', cursor:'pointer' }}
                  >
                    <td style={tdSt}>
                      <div style={{ fontWeight:700, fontSize:'.83rem' }}>{c.nombre || '—'}</div>
                      <div style={{ fontSize:'.72rem', color:'#888' }}>{c.email}</div>
                      {c.rol === 'admin' && <span style={{ fontSize:'.65rem', background:'#E8F5E9', color:G, borderRadius:3, padding:'1px 5px', fontWeight:700 }}>ADMIN</span>}
                    </td>
                    <td style={{ ...tdSt, color:'#888' }}>{c.empresa || '—'}</td>
                    <td style={tdSt}><Badge label={TIER_LABEL[c.tier] || c.tier || 'General'} bg={bg} color={color} /></td>
                    <td style={{ ...tdSt, fontSize:'.78rem', color:'#555' }}>{listaLabel}</td>
                    <td style={{ ...tdSt, textAlign:'center', fontWeight:700, color: nOrdenes ? G : '#ccc' }}>{nOrdenes}</td>
                    <td style={tdSt}>
                      <span style={{ fontSize:'.7rem', fontWeight:700, color: c.activo !== false ? '#1B5E20' : '#C62828' }}>
                        {c.activo !== false ? '● Activo' : '○ Inactivo'}
                      </span>
                    </td>
                    <td style={{ ...tdSt, color:'#4A9E6A', fontSize:'.75rem', fontWeight:600 }}>Ver →</td>
                  </tr>
                );
              })}
              {!loading && !filtrados.length && (
                <tr><td colSpan={7} style={{ ...tdSt, textAlign:'center', color:'#888', padding:'40px' }}>Sin clientes</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', position:'sticky', top:24, maxHeight:'85vh', overflowY:'auto' }}>
            {/* Header */}
            <div style={{ background:G, color:'#F5F0E4', padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'8px 8px 0 0' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:'.9rem' }}>{selected.nombre || 'Cliente'}</div>
                <div style={{ fontSize:'.72rem', opacity:.7 }}>{selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#F5F0E4', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ padding:18 }}>
              {/* Edit form */}
              <div style={{ fontWeight:700, fontSize:'.75rem', textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:12 }}>Datos del cliente</div>

              <label style={LS}>Nombre<input value={editForm.nombre} onChange={e => ef('nombre', e.target.value)} style={IS} /></label>
              <label style={LS}>Empresa<input value={editForm.empresa} onChange={e => ef('empresa', e.target.value)} style={IS} /></label>
              <label style={LS}>Teléfono<input value={editForm.telefono} onChange={e => ef('telefono', e.target.value)} style={IS} /></label>
              <label style={LS}>NIT<input value={editForm.nit} onChange={e => ef('nit', e.target.value)} placeholder="CF" style={IS} /></label>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 10px' }}>
                <label style={LS}>
                  Tier / Nivel
                  <select value={editForm.tier} onChange={e => ef('tier', e.target.value)} style={IS}>
                    {Object.entries(TIER_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label style={LS}>
                  Lista de precios
                  <select value={editForm.listaId} onChange={e => ef('listaId', e.target.value)} style={{ ...IS, borderColor: editForm.listaId !== 'general' ? G : '#E0E0E0' }}>
                    <option value="general">General (pública)</option>
                    {listas.map(l => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                  {listas.length === 0 && (
                    <span style={{ fontSize:'.68rem', color:'#E65100', marginTop:2 }}>
                      Sin listas personalizadas. Crea una en Listas de Precio.
                    </span>
                  )}
                </label>
              </div>

              <div style={{ display:'flex', gap:14, fontSize:'.83rem', marginBottom:14 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                  <input type="checkbox" checked={editForm.activo} onChange={e => ef('activo', e.target.checked)} />
                  Activo
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                  <input type="checkbox" checked={editForm.rol === 'admin'} onChange={e => ef('rol', e.target.checked ? 'admin' : '')} />
                  Administrador
                </label>
              </div>

              <button onClick={handleSave} disabled={saving} style={{ width:'100%', padding:'10px', background: saving ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: saving ? 'not-allowed' : 'pointer', marginBottom:18 }}>
                {saving ? 'Guardando…' : '✓ Guardar cambios'}
              </button>

              {/* Order history */}
              <div style={{ borderTop:'1px solid #F0F0EC', paddingTop:14 }}>
                <div style={{ fontWeight:700, fontSize:'.75rem', textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:10 }}>
                  Pedidos ({ordenesMap[selected.id] || 0})
                </div>
                {clientOrdenes.length === 0 ? (
                  <div style={{ fontSize:'.8rem', color:'#aaa', textAlign:'center', padding:'16px 0' }}>Sin pedidos aún</div>
                ) : clientOrdenes.map(o => (
                  <div key={o.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #F5F5F0', fontSize:'.8rem' }}>
                    <div>
                      <span style={{ fontWeight:700, color:G }}>{o.correlativo}</span>
                      <span style={{ color:'#888', marginLeft:8 }}>{o.fecha}</span>
                    </div>
                    <span style={{ fontWeight:700, color:'#2D6645' }}>{fmtQ(o.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
