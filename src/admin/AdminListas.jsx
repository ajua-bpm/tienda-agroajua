import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtQ } from '../utils/format.js';

const G = '#1A3D28';
const IS = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

export default function AdminListas() {
  const { data: listas,    loading: ll } = useCollection('t_listas',    { orderField: 'nombre', limitN: 50 });
  const { data: productos, loading: lp } = useCollection('t_productos', { orderField: 'nombre', limitN: 300 });
  const { add, set, remove } = useWrite('t_listas');
  const toast = useToast();

  const [selected, setSelected] = useState(null); // lista being edited
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [items, setItems] = useState([]); // { productoId, precio }
  const [saving, setSaving] = useState(false);

  const startNew = () => { setSelected(null); setNombre(''); setDescripcion(''); setItems([]); };
  const startEdit = l => {
    setSelected(l);
    setNombre(l.nombre);
    setDescripcion(l.descripcion || '');
    setItems(l.items || []);
  };

  const setItemPrecio = (productoId, precio) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.productoId === productoId);
      const val = parseFloat(precio) || 0;
      if (idx >= 0) {
        const next = [...prev];
        if (val === 0) { next.splice(idx, 1); return next; }
        next[idx] = { ...next[idx], precio: val };
        return next;
      }
      if (val === 0) return prev;
      return [...prev, { productoId, precio: val }];
    });
  };

  const getItemPrecio = productoId => {
    const found = items.find(i => i.productoId === productoId);
    return found ? found.precio : '';
  };

  const handleSave = async () => {
    if (!nombre.trim()) { toast('Nombre de lista requerido', 'error'); return; }
    setSaving(true);
    try {
      const data = { nombre: nombre.trim(), descripcion, items };
      if (selected) {
        await set(selected.id, data);
        toast('✓ Lista actualizada');
      } else {
        await add(data);
        toast('✓ Lista creada');
      }
      startNew();
    } finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar esta lista de precios?')) return;
    await remove(id);
    toast('Lista eliminada');
    if (selected?.id === id) startNew();
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: G, marginBottom: 18 }}>Listas de Precio</h1>
      <p style={{ fontSize: '.83rem', color: '#888', marginBottom: 20 }}>
        Define listas para clientes generales y negociados. Cada producto puede tener un precio diferente por lista.
        La lista <strong>general</strong> aplica a todos los clientes registrados sin lista específica.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* List of listas */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: G, color: '#fff', fontWeight: 700, fontSize: '.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Listas
            <button onClick={startNew} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: '.72rem', cursor: 'pointer', fontWeight: 600 }}>+ Nueva</button>
          </div>
          {listas.map(l => (
            <div key={l.id} onClick={() => startEdit(l)}
              style={{ padding: '11px 16px', borderBottom: '1px solid #F0F0EC', cursor: 'pointer', background: selected?.id === l.id ? '#E8F5E9' : 'transparent', transition: 'background .12s' }}>
              <div style={{ fontWeight: 700, fontSize: '.83rem', color: G }}>{l.nombre}</div>
              <div style={{ fontSize: '.7rem', color: '#888' }}>{(l.items || []).length} productos con precio</div>
            </div>
          ))}
          {!listas.length && !ll && <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '.8rem' }}>Sin listas creadas</div>}
        </div>

        {/* Edit form */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: 20 }}>
          <div style={{ fontWeight: 700, color: G, marginBottom: 14, fontSize: '.88rem' }}>
            {selected ? `✏️ Editar: ${selected.nombre}` : '+ Nueva lista de precio'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', marginBottom: 16 }}>
            <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555' }}>
              Nombre *
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Clientes Canal Moderno" style={IS} />
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555' }}>
              Descripción
              <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" style={IS} />
            </label>
          </div>

          <div style={{ fontWeight: 700, fontSize: '.75rem', textTransform: 'uppercase', color: '#888', marginBottom: 10, letterSpacing: '.06em' }}>
            Precios por producto <span style={{ fontWeight: 400 }}>(dejá en blanco para usar precio general del producto)</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F5F5F0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>Producto</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>Precio Público</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>Precio General</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: G }}>Precio Esta Lista</th>
                </tr>
              </thead>
              <tbody>
                {productos.filter(p => p.activo !== false).map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 ? '#F9F9F6' : '#fff', borderBottom: '1px solid #F0F0EC' }}>
                    <td style={{ padding: '8px 12px', fontSize: '.83rem', fontWeight: 600 }}>{p.nombre}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '.83rem', color: '#888' }}>{fmtQ(p.precioPublico)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '.83rem', color: '#888' }}>{fmtQ(p.precioGeneral)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <input
                        type="number" min="0" step="0.01"
                        value={getItemPrecio(p.id)}
                        onChange={e => setItemPrecio(p.id, e.target.value)}
                        placeholder={fmtQ(p.precioGeneral)}
                        style={{ width: 100, padding: '5px 8px', border: getItemPrecio(p.id) ? `1.5px solid ${G}` : '1.5px solid #E0E0E0', borderRadius: 4, fontSize: '.83rem', textAlign: 'right', outline: 'none', fontFamily: 'inherit' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'10px', background: saving ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando…' : selected ? 'Actualizar lista' : 'Crear lista'}
            </button>
            {selected && (
              <button onClick={() => handleDelete(selected.id)} style={{ padding:'10px 14px', background:'#FFEBEE', color:'#C62828', border:'none', borderRadius:4, fontSize:'.83rem', cursor:'pointer', fontWeight:600 }}>Eliminar</button>
            )}
            <button onClick={startNew} style={{ padding:'10px 14px', background:'#F5F5F5', border:'1px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', cursor:'pointer' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
