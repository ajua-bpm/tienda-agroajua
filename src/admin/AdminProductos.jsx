import { useState } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtQ } from '../utils/format.js';
import { storage, ref, uploadBytes, getDownloadURL } from '../firebase.js';

const G = '#1A3D28';
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555' };
const IS = { padding:'9px 12px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };
const thSt = { color:'#fff', padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', background: G };
const tdSt = { padding:'9px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0EC' };

const BLANK = { nombre:'', descripcion:'', categoria:'', unidad:'', precioPublico:'', precioGeneral:'', enStock:true, activo:true, emoji:'', foto:'' };

export default function AdminProductos() {
  const { data: productos, loading } = useCollection('t_productos', { orderField: 'nombre', limitN: 300 });
  const { add, update, remove, saving } = useWrite('t_productos');
  const toast = useToast();

  const [form, setForm]     = useState({ ...BLANK });
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const startEdit = p => { setForm({ ...BLANK, ...p }); setEditing(p.id); };
  const cancelEdit = () => { setForm({ ...BLANK }); setEditing(null); };

  const handleSave = async () => {
    if (!form.nombre) { toast('Nombre es requerido', 'error'); return; }
    const data = {
      nombre:       form.nombre.trim(),
      descripcion:  form.descripcion,
      categoria:    form.categoria,
      unidad:       form.unidad,
      precioPublico: parseFloat(form.precioPublico) || 0,
      precioGeneral: parseFloat(form.precioGeneral) || parseFloat(form.precioPublico) || 0,
      enStock:       form.enStock !== false,
      activo:        form.activo !== false,
      emoji:         form.emoji,
      foto:          form.foto,
    };
    if (editing) {
      await update(editing, data);
      toast('✓ Producto actualizado');
    } else {
      await add(data);
      toast('✓ Producto creado');
    }
    cancelEdit();
  };

  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    await remove(id);
    toast('Producto eliminado');
  };

  const handleFoto = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `t_productos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      s('foto', url);
      toast('✓ Imagen subida');
    } catch { toast('Error al subir imagen', 'error'); }
    finally { setUploading(false); }
  };

  const toggleActivo = async (p) => {
    await update(p.id, { activo: !p.activo });
    toast(p.activo ? 'Producto desactivado' : 'Producto activado');
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: G, marginBottom: 18 }}>Productos ({productos.length})</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Producto', 'Cat.', 'Unidad', 'Precio Pub.', 'Precio Gral.', 'Stock', 'Activo', ''].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ ...tdSt, textAlign:'center', color:'#888' }}>Cargando…</td></tr>}
              {productos.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 ? '#F9F9F6' : '#fff' }}>
                  <td style={tdSt}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>{p.foto ? <img src={p.foto} alt={p.nombre} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} /> : (p.emoji || '🌿')}</span>
                      <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                    </div>
                  </td>
                  <td style={{ ...tdSt, color: '#888' }}>{p.categoria || '—'}</td>
                  <td style={{ ...tdSt, color: '#888' }}>{p.unidad || '—'}</td>
                  <td style={{ ...tdSt, fontWeight: 600, color: '#2D6645' }}>{fmtQ(p.precioPublico)}</td>
                  <td style={{ ...tdSt, fontWeight: 600, color: '#2D6645' }}>{fmtQ(p.precioGeneral)}</td>
                  <td style={tdSt}>
                    <span style={{ fontSize: '.7rem', fontWeight: 700, color: p.enStock !== false ? '#1B5E20' : '#C62828' }}>
                      {p.enStock !== false ? '✓ Disponible' : '✗ Sin stock'}
                    </span>
                  </td>
                  <td style={tdSt}>
                    <button onClick={() => toggleActivo(p)} style={{ padding: '3px 10px', border: '1px solid', borderRadius: 4, fontSize: '.7rem', fontWeight: 700, cursor: 'pointer', borderColor: p.activo !== false ? '#1B5E20' : '#ccc', background: p.activo !== false ? '#E8F5E9' : '#F5F5F5', color: p.activo !== false ? '#1B5E20' : '#888' }}>
                      {p.activo !== false ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td style={tdSt}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => startEdit(p)} style={{ padding: '4px 10px', background: '#E3F2FD', color: '#1565C0', border: 'none', borderRadius: 4, fontSize: '.72rem', cursor: 'pointer', fontWeight: 600 }}>Editar</button>
                      <button onClick={() => handleDelete(p.id)} style={{ padding: '4px 10px', background: '#FFEBEE', color: '#C62828', border: 'none', borderRadius: 4, fontSize: '.72rem', cursor: 'pointer', fontWeight: 600 }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !productos.length && <tr><td colSpan={8} style={{ ...tdSt, textAlign:'center', color:'#888', padding:'40px' }}>Sin productos. Crea el primero.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Form */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: 20, position: 'sticky', top: 24 }}>
          <div style={{ fontWeight: 700, color: G, marginBottom: 14, fontSize: '.88rem' }}>
            {editing ? '✏️ Editar producto' : '+ Nuevo producto'}
          </div>
          <label style={LS}>Nombre *<input value={form.nombre} onChange={e => s('nombre', e.target.value)} style={IS} /></label>
          <label style={{ ...LS, marginTop: 10 }}>Descripción<textarea value={form.descripcion} onChange={e => s('descripcion', e.target.value)} rows={2} style={{ ...IS, resize: 'vertical' }} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
            <label style={{ ...LS, marginTop: 10 }}>Categoría<input value={form.categoria} onChange={e => s('categoria', e.target.value)} placeholder="verdura, fruta..." style={IS} /></label>
            <label style={{ ...LS, marginTop: 10 }}>Unidad<input value={form.unidad} onChange={e => s('unidad', e.target.value)} placeholder="caja, kg, unidad..." style={IS} /></label>
            <label style={{ ...LS, marginTop: 10 }}>Precio público (Q)<input type="number" min="0" step="0.01" value={form.precioPublico} onChange={e => s('precioPublico', e.target.value)} style={IS} /></label>
            <label style={{ ...LS, marginTop: 10 }}>Precio general (Q)<input type="number" min="0" step="0.01" value={form.precioGeneral} onChange={e => s('precioGeneral', e.target.value)} style={IS} /></label>
            <label style={{ ...LS, marginTop: 10 }}>Emoji<input value={form.emoji} onChange={e => s('emoji', e.target.value)} placeholder="🥬" style={IS} /></label>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: '.82rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.enStock !== false} onChange={e => s('enStock', e.target.checked)} />
              Disponible
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo !== false} onChange={e => s('activo', e.target.checked)} />
              Activo
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ ...LS, marginBottom: 4 }}>Foto del producto</div>
            {form.foto && <img src={form.foto} alt="preview" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />}
            <input type="file" accept="image/*" onChange={handleFoto} style={{ fontSize: '.78rem' }} />
            {uploading && <div style={{ fontSize: '.72rem', color: '#888', marginTop: 4 }}>Subiendo imagen…</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', background: saving ? '#ccc' : G, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '.83rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear producto'}
            </button>
            {editing && <button onClick={cancelEdit} style={{ padding: '10px 14px', background: '#F5F5F5', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: '.83rem', cursor: 'pointer' }}>Cancelar</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
