import { useState, useRef } from 'react';
import { db, collection, addDoc, setDoc, doc, getDocs, query, where, serverTimestamp } from '../firebase.js';
import { useCollection } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtQ } from '../utils/format.js';

const G = '#1A3D28';

// ── CSV parser (handles quoted fields with commas) ─────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

// ── Template download ──────────────────────────────────────────────
function downloadCSV(rows, filename) {
  const headers = Object.keys(rows[0]);
  const lines   = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))];
  const blob    = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a       = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

const TEMPLATE_PRODUCTOS = [
  { nombre:'Repollo Verde', descripcion:'Caja 4 unidades calibre A', categoria:'verdura', unidad:'caja', preciopublico:'45', precioGeneral:'38', emoji:'🥬' },
  { nombre:'Zanahoria Baby', descripcion:'Bolsa 1 kg lavada', categoria:'verdura', unidad:'bolsa', preciopublico:'22', precioGeneral:'18', emoji:'🥕' },
];

const TEMPLATE_PRECIOS = [
  { producto:'Repollo Verde', precio:'32.50' },
  { producto:'Zanahoria Baby', precio:'15.00' },
];

export default function AdminImport() {
  const { data: listas }    = useCollection('t_listas', { orderField:'nombre', limitN:50 });
  const { data: productos } = useCollection('t_productos', { orderField:'nombre', limitN:300 });
  const toast = useToast();

  // Products import
  const [prodRows,  setProdRows]  = useState([]);
  const [prodFile,  setProdFile]  = useState('');
  const [importingP, setImportingP] = useState(false);
  const [resultP,   setResultP]   = useState(null);
  const prodRef = useRef();

  // Price list import
  const [precioRows,  setPrecioRows]  = useState([]);
  const [precioFile,  setPrecioFile]  = useState('');
  const [listaTarget, setListaTarget] = useState('');
  const [listaNombre, setListaNombre] = useState('');
  const [importingL,  setImportingL]  = useState(false);
  const [resultL,     setResultL]     = useState(null);
  const precioRef = useRef();

  // ── Read product CSV ──
  const handleProdCSV = e => {
    const file = e.target.files[0];
    if (!file) return;
    setProdFile(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result);
      setProdRows(rows);
      setResultP(null);
    };
    reader.readAsText(file, 'utf-8');
  };

  // ── Import products ──
  const importarProductos = async () => {
    if (!prodRows.length) return;
    setImportingP(true);
    let ok = 0, skip = 0;
    try {
      for (const row of prodRows) {
        const nombre = row.nombre || row.Nombre;
        if (!nombre?.trim()) { skip++; continue; }
        await addDoc(collection(db, 't_productos'), {
          nombre:        nombre.trim(),
          descripcion:   row.descripcion || row.Descripcion || '',
          categoria:     (row.categoria || row.Categoria || '').toLowerCase(),
          unidad:        row.unidad || row.Unidad || 'unidad',
          precioPublico: parseFloat(row.preciopublico || row.precioPublico || row['precio publico'] || 0),
          precioGeneral: parseFloat(row.precioGeneral || row.preciogeneral || row['precio general'] || row.preciopublico || 0),
          emoji:         row.emoji || row.Emoji || '🌿',
          enStock:       true,
          activo:        true,
          creadoEn:      serverTimestamp(),
        });
        ok++;
      }
      setResultP({ ok, skip });
      toast(`✓ ${ok} productos importados`);
      setProdRows([]);
      setProdFile('');
      if (prodRef.current) prodRef.current.value = '';
    } catch (err) {
      toast('Error en importación: ' + err.message, 'error');
    } finally { setImportingP(false); }
  };

  // ── Read price CSV ──
  const handlePrecioCSV = e => {
    const file = e.target.files[0];
    if (!file) return;
    setPrecioFile(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result);
      setPrecioRows(rows);
      setResultL(null);
    };
    reader.readAsText(file, 'utf-8');
  };

  // Build product name→id map
  const prodNameMap = Object.fromEntries(
    productos.map(p => [p.nombre.toLowerCase().trim(), p.id])
  );

  // ── Import price list ──
  const importarPrecios = async () => {
    if (!precioRows.length) return;
    if (!listaTarget && !listaNombre.trim()) {
      toast('Seleccioná una lista existente o ingresá un nombre para la nueva', 'warn'); return;
    }
    setImportingL(true);
    let ok = 0, noMatch = [];
    try {
      const items = [];
      for (const row of precioRows) {
        const nombre  = (row.producto || row.Producto || row.nombre || row.Nombre || '').trim();
        const precio  = parseFloat(row.precio || row.Precio || 0);
        if (!nombre || !precio) continue;
        const prodId  = prodNameMap[nombre.toLowerCase()] || null;
        if (!prodId) { noMatch.push(nombre); continue; }
        items.push({ productoId: prodId, precio });
        ok++;
      }

      if (listaTarget) {
        // Update existing list
        const snap = await getDocs(query(collection(db, 't_listas')));
        const listaDoc = snap.docs.find(d => d.id === listaTarget);
        const prevItems = listaDoc?.data()?.items || [];
        // Merge: keep existing, override matching
        const merged = [...prevItems];
        for (const ni of items) {
          const idx = merged.findIndex(x => x.productoId === ni.productoId);
          if (idx >= 0) merged[idx] = ni; else merged.push(ni);
        }
        await setDoc(doc(db, 't_listas', listaTarget), { items: merged }, { merge: true });
        toast(`✓ ${ok} precios actualizados en "${listas.find(l=>l.id===listaTarget)?.nombre}"`);
      } else {
        // Create new list
        await addDoc(collection(db, 't_listas'), {
          nombre:      listaNombre.trim(),
          descripcion: '',
          items,
          creadoEn:    serverTimestamp(),
        });
        toast(`✓ Lista "${listaNombre.trim()}" creada con ${ok} precios`);
      }

      setResultL({ ok, noMatch });
      setPrecioRows([]);
      setPrecioFile('');
      setListaNombre('');
      if (precioRef.current) precioRef.current.value = '';
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    } finally { setImportingL(false); }
  };

  return (
    <div style={{ maxWidth:900 }}>
      <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:G, marginBottom:6 }}>Carga Masiva</h1>
      <p style={{ fontSize:'.83rem', color:'#888', marginBottom:24 }}>Importá productos y listas de precio desde archivos CSV.</p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>

        {/* ── Productos ── */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', padding:22 }}>
          <div style={{ fontWeight:700, color:G, marginBottom:14, fontSize:'.9rem', paddingBottom:10, borderBottom:'1px solid #F0F0EC' }}>
            📦 Importar Productos
          </div>

          {/* Template */}
          <div style={{ marginBottom:14, padding:'10px 14px', background:'#F5F5F0', borderRadius:6, fontSize:'.8rem', color:'#555' }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Columnas requeridas (CSV):</div>
            <code style={{ fontSize:'.72rem', display:'block', lineHeight:1.8 }}>
              nombre, descripcion, categoria, unidad,<br/>
              precioPublico, precioGeneral, emoji
            </code>
            <button onClick={() => downloadCSV(TEMPLATE_PRODUCTOS, 'template_productos.csv')}
              style={{ marginTop:8, padding:'5px 12px', background:G, color:'#fff', border:'none', borderRadius:4, fontSize:'.72rem', cursor:'pointer', fontWeight:600 }}>
              ⬇ Descargar plantilla CSV
            </button>
          </div>

          <input type="file" accept=".csv,.txt" ref={prodRef} onChange={handleProdCSV}
            style={{ fontSize:'.8rem', marginBottom:10, width:'100%' }} />
          {prodFile && <div style={{ fontSize:'.78rem', color:'#555', marginBottom:8 }}>📄 {prodFile} — {prodRows.length} filas detectadas</div>}

          {/* Preview */}
          {prodRows.length > 0 && (
            <div style={{ background:'#F9F9F6', borderRadius:6, padding:10, marginBottom:12, maxHeight:160, overflowY:'auto', fontSize:'.75rem' }}>
              <div style={{ fontWeight:700, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Vista previa ({Math.min(prodRows.length,5)} de {prodRows.length})</div>
              {prodRows.slice(0,5).map((r,i) => (
                <div key={i} style={{ display:'flex', gap:8, marginBottom:4, padding:'4px 0', borderBottom:'1px solid #F0F0EC' }}>
                  <span style={{ fontWeight:700, minWidth:0, flex:1 }}>{r.nombre || r.Nombre}</span>
                  <span style={{ color:'#888' }}>{r.unidad || r.Unidad}</span>
                  <span style={{ color:'#2D6645', fontWeight:600 }}>Q{r.preciopublico || r.precioPublico}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={importarProductos} disabled={!prodRows.length || importingP}
            style={{ width:'100%', padding:'10px', background: (!prodRows.length || importingP) ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: (!prodRows.length||importingP) ? 'not-allowed' : 'pointer' }}>
            {importingP ? 'Importando…' : `Importar ${prodRows.length} productos`}
          </button>

          {resultP && (
            <div style={{ marginTop:10, padding:'10px 14px', background:'#E8F5E9', borderRadius:6, fontSize:'.8rem', color:G }}>
              ✓ {resultP.ok} importados{resultP.skip > 0 ? ` · ${resultP.skip} saltados (sin nombre)` : ''}
            </div>
          )}
        </div>

        {/* ── Listas de precio ── */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', padding:22 }}>
          <div style={{ fontWeight:700, color:G, marginBottom:14, fontSize:'.9rem', paddingBottom:10, borderBottom:'1px solid #F0F0EC' }}>
            💲 Importar Lista de Precios
          </div>

          <div style={{ marginBottom:14, padding:'10px 14px', background:'#F5F5F0', borderRadius:6, fontSize:'.8rem', color:'#555' }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Columnas requeridas (CSV):</div>
            <code style={{ fontSize:'.72rem', display:'block', lineHeight:1.8 }}>
              producto, precio
            </code>
            <div style={{ marginTop:4, color:'#888', fontSize:'.72rem' }}>El nombre de producto debe coincidir exactamente con los productos cargados.</div>
            <button onClick={() => downloadCSV(TEMPLATE_PRECIOS, 'template_precios.csv')}
              style={{ marginTop:8, padding:'5px 12px', background:G, color:'#fff', border:'none', borderRadius:4, fontSize:'.72rem', cursor:'pointer', fontWeight:600 }}>
              ⬇ Descargar plantilla CSV
            </button>
          </div>

          {/* Target list */}
          <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
            Destino
            <select value={listaTarget} onChange={e => { setListaTarget(e.target.value); setListaNombre(''); }}
              style={{ padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 }}>
              <option value="">+ Crear nueva lista</option>
              {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </label>

          {!listaTarget && (
            <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#555', marginBottom:10 }}>
              Nombre de la nueva lista
              <input value={listaNombre} onChange={e => setListaNombre(e.target.value)}
                placeholder="Ej. Clientes Canal Moderno"
                style={{ padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 }} />
            </label>
          )}

          <input type="file" accept=".csv,.txt" ref={precioRef} onChange={handlePrecioCSV}
            style={{ fontSize:'.8rem', marginBottom:10, width:'100%' }} />
          {precioFile && <div style={{ fontSize:'.78rem', color:'#555', marginBottom:8 }}>📄 {precioFile} — {precioRows.length} filas detectadas</div>}

          {/* Preview */}
          {precioRows.length > 0 && (
            <div style={{ background:'#F9F9F6', borderRadius:6, padding:10, marginBottom:12, maxHeight:160, overflowY:'auto', fontSize:'.75rem' }}>
              <div style={{ fontWeight:700, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Vista previa</div>
              {precioRows.slice(0,5).map((r,i) => {
                const nombre = r.producto || r.Producto || r.nombre || r.Nombre || '';
                const found  = !!prodNameMap[nombre.toLowerCase()];
                return (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', marginBottom:4, padding:'4px 0', borderBottom:'1px solid #F0F0EC' }}>
                    <span style={{ fontWeight:600, color: found ? '#1A1A18' : '#C62828' }}>
                      {found ? '✓' : '✗'} {nombre}
                    </span>
                    <span style={{ color:'#2D6645', fontWeight:700 }}>Q {r.precio || r.Precio}</span>
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={importarPrecios} disabled={!precioRows.length || importingL}
            style={{ width:'100%', padding:'10px', background: (!precioRows.length||importingL) ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: (!precioRows.length||importingL) ? 'not-allowed' : 'pointer' }}>
            {importingL ? 'Importando…' : `Importar ${precioRows.length} precios`}
          </button>

          {resultL && (
            <div style={{ marginTop:10, padding:'10px 14px', background: resultL.noMatch.length ? '#FFF3E0' : '#E8F5E9', borderRadius:6, fontSize:'.8rem', color: resultL.noMatch.length ? '#E65100' : G }}>
              ✓ {resultL.ok} precios importados
              {resultL.noMatch.length > 0 && (
                <div style={{ marginTop:4 }}>
                  ⚠ Sin coincidencia: {resultL.noMatch.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Products reference */}
      {productos.length > 0 && (
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', padding:20, marginTop:24 }}>
          <div style={{ fontWeight:700, color:G, marginBottom:12, fontSize:'.83rem' }}>
            Productos cargados ({productos.length}) — referencia para el CSV de precios
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {productos.map(p => (
              <span key={p.id} style={{ padding:'3px 10px', background:'#F0F5F0', borderRadius:100, fontSize:'.72rem', fontWeight:600, color:G, border:'1px solid #D0E8D0' }}>
                {p.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
