import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db, doc, updateDoc } from '../firebase.js';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtQ } from '../utils/format.js';

const G  = '#1A3D28';
const IS = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:10 };

// ── XLSX helpers ────────────────────────────────────────────────────────────
function downloadXLSX(sheetData, filename) {
  const ws = XLSX.utils.json_to_sheet(sheetData);
  ws['!cols'] = Object.keys(sheetData[0] || {}).map(k => ({ wch: Math.max(k.length + 4, 18) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Precios');
  XLSX.writeFile(wb, filename);
}

async function parseXLSX(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onerror = () => rej(new Error('Error al leer archivo'));
    reader.onload  = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type:'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        res(XLSX.utils.sheet_to_json(ws, { defval:'' }));
      } catch(e) { rej(e); }
    };
    reader.readAsArrayBuffer(file);
  });
}

export default function AdminListas() {
  const { data: listas,    loading: ll } = useCollection('t_listas',    { orderField:'nombre', limitN:50 });
  const { data: productos               } = useCollection('t_productos', { orderField:'nombre', limitN:300 });
  const { data: clientes                } = useCollection('t_clientes',  { limitN:500 });
  const { add, set, remove } = useWrite('t_listas');
  const toast = useToast();

  const [selected, setSelected]       = useState(null);
  const [nombre, setNombre]           = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [items, setItems]             = useState([]);
  const [saving, setSaving]           = useState(false);
  const [busquedaProd, setBusquedaProd] = useState('');
  const [addingCliente, setAddingCliente] = useState('');
  const xlsxRef = useRef();

  // ── List selection ────────────────────────────────────────────────────────
  const startNew  = () => { setSelected(null); setNombre(''); setDescripcion(''); setItems([]); setBusquedaProd(''); setAddingCliente(''); };
  const startEdit = l  => { setSelected(l); setNombre(l.nombre); setDescripcion(l.descripcion || ''); setItems(l.items || []); setBusquedaProd(''); setAddingCliente(''); };

  // ── Price items ───────────────────────────────────────────────────────────
  const setItemPrecio = (productoId, precio) => {
    setItems(prev => {
      const val = parseFloat(precio) || 0;
      const idx = prev.findIndex(i => i.productoId === productoId);
      if (val === 0) return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], precio:val }; return n; }
      return [...prev, { productoId, precio:val }];
    });
  };
  const getItemPrecio = id => items.find(i => i.productoId === id)?.precio ?? '';

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!nombre.trim()) { toast('Nombre de lista requerido', 'error'); return; }
    setSaving(true);
    try {
      const data = { nombre:nombre.trim(), descripcion, items };
      if (selected) { await set(selected.id, data); toast('✓ Lista actualizada'); }
      else           { await add(data);              toast('✓ Lista creada'); }
      startNew();
    } finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar esta lista? Los clientes asignados quedarán en lista general.')) return;
    await remove(id);
    toast('Lista eliminada');
    if (selected?.id === id) startNew();
  };

  const duplicarLista = l => {
    setSelected(null);
    setNombre(`${l.nombre} (actualizado)`);
    setDescripcion(l.descripcion || '');
    setItems(l.items ? [...l.items] : []);
    setBusquedaProd('');
    setAddingCliente('');
    toast(`Precios copiados de "${l.nombre}" — editá y guardá como nueva lista`);
  };

  // ── Clients ───────────────────────────────────────────────────────────────
  const clientesAsignados    = useMemo(() => !selected ? [] : clientes.filter(c => c.listaId === selected.id), [clientes, selected]);
  const clientesDisponibles  = useMemo(() => !selected ? [] : clientes.filter(c => (c.listaId || 'general') !== selected.id && c.rol !== 'admin'), [clientes, selected]);

  const asignarCliente = async () => {
    if (!addingCliente || !selected) return;
    await updateDoc(doc(db, 't_clientes', addingCliente), { listaId: selected.id });
    toast('✓ Cliente asignado');
    setAddingCliente('');
  };

  const quitarCliente = async clienteId => {
    await updateDoc(doc(db, 't_clientes', clienteId), { listaId: 'general' });
    toast('Cliente movido a lista general');
  };

  // ── Excel download ─────────────────────────────────────────────────────
  const downloadExcel = () => {
    const rows = productos.filter(p => p.activo !== false).map(p => ({
      Producto:        p.nombre,
      Categoria:       p.categoria || '',
      Unidad:          p.unidad    || '',
      PrecioPublico:   p.precioPublico  || 0,
      PrecioGeneral:   p.precioGeneral  || 0,
      PrecioEstaLista: getItemPrecio(p.id) || '',
    }));
    downloadXLSX(rows, `lista_${(nombre || 'precios').replace(/\s+/g,'_')}.xlsx`);
  };

  // ── Excel upload ──────────────────────────────────────────────────────
  const handleXLSX = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows    = await parseXLSX(file);
      const prodMap = Object.fromEntries(productos.map(p => [p.nombre.toLowerCase().trim(), p.id]));
      let ok = 0, skip = 0;
      const newItems = [...items];
      for (const row of rows) {
        const pNombre  = (row['Producto'] || row['producto'] || '').toString().trim();
        const rawPrice = row['PrecioEstaLista'] ?? row['Precio'] ?? row['precio'] ?? '';
        if (!pNombre) continue;
        const prodId = prodMap[pNombre.toLowerCase()];
        if (!prodId) { skip++; continue; }
        // Empty cell → skip, keep existing price (no borrar)
        if (rawPrice === '' || rawPrice === null || rawPrice === undefined) continue;
        const precio = parseFloat(rawPrice) || 0;
        const idx = newItems.findIndex(i => i.productoId === prodId);
        if (precio > 0) {
          if (idx >= 0) newItems[idx] = { productoId:prodId, precio };
          else          newItems.push({ productoId:prodId, precio });
          ok++;
        } else if (idx >= 0) {
          // Explicitly 0 → remove
          newItems.splice(idx, 1);
        }
      }
      setItems(newItems);
      toast(`✓ ${ok} precios actualizados${skip ? ` · ${skip} sin coincidencia` : ''}`);
    } catch(err) { toast('Error al leer Excel: ' + err.message, 'error'); }
    finally { if (xlsxRef.current) xlsxRef.current.value = ''; }
  };

  // ── Product filter ─────────────────────────────────────────────────────
  const prodFiltrados = useMemo(() => {
    let list = productos.filter(p => p.activo !== false);
    if (busquedaProd) {
      const q = busquedaProd.toLowerCase();
      list = list.filter(p => p.nombre.toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q));
    }
    return list;
  }, [productos, busquedaProd]);

  return (
    <div>
      <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:G, marginBottom:6 }}>Listas de Precio</h1>
      <p style={{ fontSize:'.83rem', color:'#888', marginBottom:20 }}>
        Define listas para clientes negociados. Asigná clientes y cargá precios en Excel.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'230px 1fr', gap:20, alignItems:'start' }}>

        {/* ── Left: index ── */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', background:G, color:'#fff', fontWeight:700, fontSize:'.8rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            Listas
            <button onClick={startNew} style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', color:'#fff', padding:'3px 10px', borderRadius:4, fontSize:'.72rem', cursor:'pointer', fontWeight:600 }}>+ Nueva</button>
          </div>
          {listas.map(l => {
            const nClientes = clientes.filter(c => c.listaId === l.id).length;
            return (
              <div key={l.id}
                style={{ padding:'10px 16px', borderBottom:'1px solid #F0F0EC', cursor:'pointer', background: selected?.id === l.id ? '#E8F5E9' : 'transparent' }}
                onClick={() => startEdit(l)}>
                <div style={{ fontWeight:700, fontSize:'.83rem', color:G }}>{l.nombre}</div>
                <div style={{ fontSize:'.7rem', color:'#888', marginTop:2 }}>
                  {(l.items||[]).length} prod · <span style={{ color: nClientes > 0 ? '#2D6645' : '#ccc', fontWeight:600 }}>{nClientes} cliente{nClientes !== 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); duplicarLista(l); }}
                  title="Duplicar para actualizar precios"
                  style={{ marginTop:5, padding:'2px 8px', background:'#E3F2FD', color:'#1565C0', border:'none', borderRadius:3, fontSize:'.68rem', fontWeight:600, cursor:'pointer' }}>
                  ⧉ Duplicar precios
                </button>
              </div>
            );
          })}
          {!listas.length && !ll && <div style={{ padding:'24px', textAlign:'center', color:'#aaa', fontSize:'.8rem' }}>Sin listas</div>}
        </div>

        {/* ── Right: edit ── */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', padding:22 }}>
          <div style={{ fontWeight:700, color:G, marginBottom:16, fontSize:'.88rem' }}>
            {selected ? `✏️ ${selected.nombre}` : '+ Nueva lista de precio'}
          </div>

          {/* Name / desc */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px', marginBottom:16 }}>
            <label style={LS}>Nombre *<input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Canal Moderno — Abr 2025" style={IS} /></label>
            <label style={LS}>Descripción<input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" style={IS} /></label>
          </div>

          {/* ── Clients ── */}
          {selected && (
            <div style={{ border:'1px solid #D0E8D0', borderRadius:6, padding:'12px 14px', marginBottom:16, background:'#F5FAF5' }}>
              <div style={{ fontWeight:700, fontSize:'.75rem', textTransform:'uppercase', color:G, letterSpacing:'.06em', marginBottom:10 }}>
                👥 Clientes con esta lista ({clientesAsignados.length})
              </div>

              {clientesAsignados.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                  {clientesAsignados.map(c => (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:5, background:'#fff', border:'1px solid #B0D8B8', borderRadius:100, padding:'3px 10px 3px 12px', fontSize:'.75rem', fontWeight:600, color:G }}>
                      {c.nombre || c.email}
                      {c.empresa && <span style={{ fontWeight:400, color:'#555', marginLeft:3 }}>· {c.empresa}</span>}
                      <button onClick={() => quitarCliente(c.id)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#C62828', fontSize:'.9rem', lineHeight:1, padding:'0 2px', marginLeft:2 }}>×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:'.78rem', color:'#aaa', marginBottom:10 }}>Sin clientes — el precio negociado no aplica a nadie todavía.</div>
              )}

              <div style={{ display:'flex', gap:8 }}>
                <select value={addingCliente} onChange={e => setAddingCliente(e.target.value)}
                  style={{ flex:1, padding:'7px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.82rem', outline:'none', fontFamily:'inherit' }}>
                  <option value="">— Agregar cliente a esta lista —</option>
                  {clientesDisponibles.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre || c.email}{c.empresa ? ` · ${c.empresa}` : ''}</option>
                  ))}
                </select>
                <button onClick={asignarCliente} disabled={!addingCliente}
                  style={{ padding:'7px 16px', background: addingCliente ? G : '#ccc', color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.8rem', cursor: addingCliente ? 'pointer' : 'not-allowed' }}>
                  Asignar
                </button>
              </div>
            </div>
          )}

          {/* ── Product prices ── */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:8, flexWrap:'wrap' }}>
            <div style={{ fontWeight:700, fontSize:'.75rem', textTransform:'uppercase', color:'#888', letterSpacing:'.06em' }}>
              Precios por producto &nbsp;<span style={{ fontWeight:400, color:G }}>{items.length} con precio asignado</span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={downloadExcel}
                style={{ padding:'5px 12px', background:'#E3F2FD', color:'#1565C0', border:'none', borderRadius:4, fontSize:'.75rem', fontWeight:600, cursor:'pointer' }}>
                ⬇ Descargar Excel
              </button>
              <label style={{ padding:'5px 12px', background:'#E8F5E9', color:G, border:'1px solid #B0D8B8', borderRadius:4, fontSize:'.75rem', fontWeight:600, cursor:'pointer', display:'inline-block' }}>
                ⬆ Subir Excel
                <input type="file" accept=".xlsx,.xls" ref={xlsxRef} onChange={handleXLSX} style={{ display:'none' }} />
              </label>
            </div>
          </div>

          {/* Search */}
          <input value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)}
            placeholder="Buscar producto por nombre o categoría..."
            style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #E8DCC8', borderRadius:5, fontSize:'.82rem', outline:'none', fontFamily:'inherit', marginBottom:10, boxSizing:'border-box' }}
          />

          <div style={{ overflowX:'auto', maxHeight:440, overflowY:'auto', border:'1px solid #F0F0EC', borderRadius:6 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                <tr style={{ background:'#F5F5F0' }}>
                  <th style={{ padding:'8px 12px', textAlign:'left', fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', color:'#555' }}>Producto</th>
                  <th style={{ padding:'8px 12px', textAlign:'left', fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', color:'#aaa' }}>Cat.</th>
                  <th style={{ padding:'8px 12px', textAlign:'right', fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', color:'#aaa' }}>Público</th>
                  <th style={{ padding:'8px 12px', textAlign:'right', fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', color:'#888' }}>General</th>
                  <th style={{ padding:'8px 12px', textAlign:'right', fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', color:G }}>Esta lista</th>
                </tr>
              </thead>
              <tbody>
                {prodFiltrados.map((p, i) => {
                  const val      = getItemPrecio(p.id);
                  const hasPrice = val !== '';
                  return (
                    <tr key={p.id} style={{ background: hasPrice ? '#F0F7F0' : (i % 2 ? '#F9F9F6' : '#fff'), borderBottom:'1px solid #F0F0EC' }}>
                      <td style={{ padding:'7px 12px', fontSize:'.83rem', fontWeight: hasPrice ? 700 : 400, color: hasPrice ? G : '#1A1A18' }}>
                        {p.nombre}
                        {hasPrice && <span style={{ marginLeft:6, fontSize:'.65rem', background:G, color:'#fff', borderRadius:3, padding:'1px 5px', verticalAlign:'middle' }}>✓</span>}
                      </td>
                      <td style={{ padding:'7px 12px', fontSize:'.75rem', color:'#aaa' }}>{p.categoria}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', fontSize:'.8rem', color:'#ccc' }}>{fmtQ(p.precioPublico)}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', fontSize:'.8rem', color:'#888' }}>{fmtQ(p.precioGeneral)}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right' }}>
                        <input type="number" min="0" step="0.01"
                          value={val}
                          onChange={e => setItemPrecio(p.id, e.target.value)}
                          placeholder={fmtQ(p.precioGeneral)}
                          style={{ width:100, padding:'5px 8px', border: hasPrice ? `1.5px solid ${G}` : '1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', textAlign:'right', outline:'none', fontFamily:'inherit', background: hasPrice ? '#F0F7F0' : '#fff' }}
                        />
                      </td>
                    </tr>
                  );
                })}
                {prodFiltrados.length === 0 && (
                  <tr><td colSpan={5} style={{ padding:'30px', textAlign:'center', color:'#aaa', fontSize:'.83rem' }}>Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ flex:1, padding:'10px', background: saving ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando…' : selected ? 'Actualizar lista' : 'Crear lista'}
            </button>
            {selected && (
              <button onClick={() => handleDelete(selected.id)}
                style={{ padding:'10px 14px', background:'#FFEBEE', color:'#C62828', border:'none', borderRadius:4, fontSize:'.83rem', cursor:'pointer', fontWeight:600 }}>
                Eliminar
              </button>
            )}
            <button onClick={startNew} style={{ padding:'10px 14px', background:'#F5F5F5', border:'1px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', cursor:'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
