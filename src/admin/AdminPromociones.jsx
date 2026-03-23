/**
 * AdminPromociones — descuentos y promociones para todos los clientes.
 * Colección: t_promociones
 * Campos: nombre, tipo ('%'|'Q'), valor, aplicaA ('todos'|'categoria'|'producto'),
 *         categoria, productoIds[], fechaInicio, fechaFin, activa
 *
 * La promo activa se aplica en Catalogo.jsx y Checkout.jsx.
 */
import { useState } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { CATEGORIAS } from '../utils/catalogos.js';
import { today } from '../utils/format.js';

const G  = '#1A3D28';
const IS = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:12 };

const BLANK = {
  nombre:      '',
  tipo:        '%',
  valor:       '',
  aplicaA:     'todos',
  categoria:   '',
  fechaInicio: today(),
  fechaFin:    '',
  activa:      true,
};

export default function AdminPromociones() {
  const { data: promos,   loading } = useCollection('t_promociones', { orderField:'fechaInicio', limitN:100 });
  const { data: productos }         = useCollection('t_productos',   { orderField:'nombre', limitN:300 });
  const { add, set, remove } = useWrite('t_promociones');
  const toast = useToast();

  const [form, setForm]   = useState({ ...BLANK });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving]   = useState(false);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const startEdit = p => { setForm({ ...BLANK, ...p }); setEditing(p.id); };
  const cancelEdit = () => { setForm({ ...BLANK }); setEditing(null); };

  const handleSave = async () => {
    if (!form.nombre.trim())            { toast('Nombre es requerido', 'error'); return; }
    if (!form.valor || form.valor <= 0) { toast('Valor del descuento requerido', 'error'); return; }
    if (!form.fechaFin)                 { toast('Fecha de fin requerida', 'error'); return; }
    if (form.tipo === '%' && form.valor > 100) { toast('Porcentaje no puede superar 100%', 'error'); return; }

    setSaving(true);
    try {
      const data = {
        nombre:      form.nombre.trim(),
        tipo:        form.tipo,
        valor:       parseFloat(form.valor),
        aplicaA:     form.aplicaA,
        categoria:   form.aplicaA === 'categoria' ? form.categoria : '',
        fechaInicio: form.fechaInicio || today(),
        fechaFin:    form.fechaFin,
        activa:      form.activa,
      };
      if (editing) { await set(editing, data); toast('✓ Promoción actualizada'); }
      else          { await add(data);          toast('✓ Promoción creada'); }
      cancelEdit();
    } catch(err) { toast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar esta promoción?')) return;
    await remove(id);
    toast('Promoción eliminada');
    if (editing === id) cancelEdit();
  };

  const toggleActiva = async (p) => {
    await set(p.id, { ...p, activa: !p.activa });
    toast(p.activa ? 'Promoción pausada' : 'Promoción activada');
  };

  // Check if promo is currently active (date range)
  const isVigente = p => {
    if (!p.activa) return false;
    const hoy = today();
    if (p.fechaInicio && hoy < p.fechaInicio) return false;
    if (p.fechaFin    && hoy > p.fechaFin)    return false;
    return true;
  };

  const fmtDesc = p => p.tipo === '%' ? `${p.valor}% off` : `Q${p.valor} off`;
  const fmtApply = p => p.aplicaA === 'todos' ? 'Todos los productos' : p.aplicaA === 'categoria' ? `Cat: ${p.categoria}` : 'Selección';

  return (
    <div style={{ maxWidth:900 }}>
      <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:G, marginBottom:6 }}>Promociones y Descuentos</h1>
      <p style={{ fontSize:'.83rem', color:'#888', marginBottom:20 }}>
        Crea descuentos temporales visibles en el catálogo para todos los clientes. Podés pausar y reactivar sin eliminar.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20, alignItems:'start' }}>

        {/* ── Table ── */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:G }}>
                {['Nombre','Descuento','Aplica a','Vigencia','Estado',''].map(h => (
                  <th key={h} style={{ padding:'9px 12px', color:'#fff', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding:'30px', textAlign:'center', color:'#888' }}>Cargando…</td></tr>}
              {promos.map((p, i) => {
                const vigente = isVigente(p);
                return (
                  <tr key={p.id} style={{ background: editing === p.id ? '#E8F5E9' : i % 2 ? '#F9F9F6' : '#fff', borderBottom:'1px solid #F0F0EC' }}>
                    <td style={{ padding:'9px 12px', fontWeight:700, fontSize:'.83rem', color:G }}>{p.nombre}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{ background: p.tipo === '%' ? '#FFF3E0' : '#E8F5E9', color: p.tipo === '%' ? '#E65100' : G, fontWeight:700, fontSize:'.8rem', borderRadius:4, padding:'3px 8px' }}>
                        {fmtDesc(p)}
                      </span>
                    </td>
                    <td style={{ padding:'9px 12px', fontSize:'.8rem', color:'#555' }}>{fmtApply(p)}</td>
                    <td style={{ padding:'9px 12px', fontSize:'.78rem', color:'#888', whiteSpace:'nowrap' }}>
                      {p.fechaInicio} → {p.fechaFin}
                    </td>
                    <td style={{ padding:'9px 12px' }}>
                      <button onClick={() => toggleActiva(p)}
                        style={{ padding:'3px 10px', border:'1px solid', borderRadius:4, fontSize:'.7rem', fontWeight:700, cursor:'pointer',
                          borderColor: vigente ? '#1B5E20' : (p.activa ? '#E0E0E0' : '#E0E0E0'),
                          background:  vigente ? '#E8F5E9' : '#F5F5F5',
                          color:       vigente ? '#1B5E20' : '#888' }}>
                        {vigente ? '● Activa' : p.activa ? '⏸ Pendiente' : '○ Pausada'}
                      </button>
                    </td>
                    <td style={{ padding:'9px 12px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => startEdit(p)} style={{ padding:'4px 10px', background:'#E3F2FD', color:'#1565C0', border:'none', borderRadius:4, fontSize:'.72rem', cursor:'pointer', fontWeight:600 }}>Editar</button>
                        <button onClick={() => handleDelete(p.id)} style={{ padding:'4px 10px', background:'#FFEBEE', color:'#C62828', border:'none', borderRadius:4, fontSize:'.72rem', cursor:'pointer', fontWeight:600 }}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !promos.length && (
                <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color:'#aaa', fontSize:'.83rem' }}>Sin promociones. Crea la primera.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Form ── */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', padding:20, position:'sticky', top:24 }}>
          <div style={{ fontWeight:700, color:G, marginBottom:14, fontSize:'.88rem' }}>
            {editing ? '✏️ Editar promoción' : '+ Nueva promoción'}
          </div>

          <label style={LS}>
            Nombre de la promoción *
            <input value={form.nombre} onChange={e => sf('nombre', e.target.value)} placeholder="Promo Semana Santa" style={IS} />
          </label>

          {/* Tipo + valor */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 10px' }}>
            <label style={LS}>
              Tipo de descuento
              <select value={form.tipo} onChange={e => sf('tipo', e.target.value)} style={IS}>
                <option value="%">Porcentaje (%)</option>
                <option value="Q">Monto fijo (Q)</option>
              </select>
            </label>
            <label style={LS}>
              Valor *
              <input type="number" min="0.01" step="0.01" value={form.valor} onChange={e => sf('valor', e.target.value)}
                placeholder={form.tipo === '%' ? '10' : '5.00'} style={IS} />
            </label>
          </div>

          {/* Aplica a */}
          <label style={LS}>
            Aplica a
            <select value={form.aplicaA} onChange={e => sf('aplicaA', e.target.value)} style={IS}>
              <option value="todos">Todos los productos</option>
              <option value="categoria">Una categoría</option>
            </select>
          </label>

          {form.aplicaA === 'categoria' && (
            <label style={LS}>
              Categoría
              <select value={form.categoria} onChange={e => sf('categoria', e.target.value)} style={IS}>
                <option value="">— Seleccionar —</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}

          {/* Dates */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 10px' }}>
            <label style={LS}>
              Desde
              <input type="date" value={form.fechaInicio} onChange={e => sf('fechaInicio', e.target.value)} style={IS} />
            </label>
            <label style={LS}>
              Hasta *
              <input type="date" value={form.fechaFin} min={form.fechaInicio || today()} onChange={e => sf('fechaFin', e.target.value)} style={IS} />
            </label>
          </div>

          {/* Activa */}
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'.83rem', marginBottom:16 }}>
            <input type="checkbox" checked={form.activa} onChange={e => sf('activa', e.target.checked)} />
            Activa desde el inicio
          </label>

          {/* Preview */}
          {form.valor > 0 && (
            <div style={{ background:'#FFF3E0', border:'1px solid #FFB74D', borderRadius:6, padding:'10px 14px', marginBottom:14, fontSize:'.8rem', color:'#E65100' }}>
              <strong>Vista previa:</strong> {fmtDesc(form)} en {form.aplicaA === 'todos' ? 'todos los productos' : `categoría "${form.categoria || '?'}"`}
              {form.tipo === '%' && <div style={{ marginTop:4, color:'#888' }}>Ej: Q100.00 → Q{(100 * (1 - form.valor/100)).toFixed(2)}</div>}
              {form.tipo === 'Q' && <div style={{ marginTop:4, color:'#888' }}>Ej: Q100.00 → Q{Math.max(0, 100 - parseFloat(form.valor)).toFixed(2)}</div>}
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ flex:1, padding:'10px', background: saving ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear promoción'}
            </button>
            {editing && (
              <button onClick={cancelEdit} style={{ padding:'10px 12px', background:'#F5F5F5', border:'1px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', cursor:'pointer' }}>Cancelar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
