import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db, collection, addDoc, setDoc, doc, getDocs, serverTimestamp } from '../firebase.js';
import { useCollection } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { CATEGORIAS, UNIDADES } from '../utils/catalogos.js';

const G = '#1A3D28';
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:10 };
const IS = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

// ── Parse file: returns array of plain objects (rows) ─────────────────────────
async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(rows);
      } catch (e) { reject(e); }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ── Download Excel workbook ───────────────────────────────────────────────────
function downloadXLSX(sheetData, filename, sheetName = 'Datos') {
  const ws = XLSX.utils.json_to_sheet(sheetData);
  // Auto column widths
  const cols = Object.keys(sheetData[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
  ws['!cols'] = cols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ── Normalize header keys ─────────────────────────────────────────────────────
const norm = obj => {
  const out = {};
  for (const k of Object.keys(obj)) out[k.toLowerCase().trim().replace(/\s+/g, '_')] = obj[k];
  return out;
};

// ── Templates ─────────────────────────────────────────────────────────────────
const TEMPLATE_PRODUCTOS = [
  { Nombre:'Repollo Verde', Descripcion:'Caja 4 unidades calibre A', Categoria:'Verduras', Unidad:'Caja', PrecioPublico:45, PrecioGeneral:38, Emoji:'🥬' },
  { Nombre:'Zanahoria Baby', Descripcion:'Bolsa 1 kg lavada', Categoria:'Verduras', Unidad:'Bolsa', PrecioPublico:22, PrecioGeneral:18, Emoji:'🥕' },
];

function makeTemplatePreciosXLSX(productos) {
  return productos.map(p => ({ Producto: p.nombre, Precio: p.precioGeneral ?? p.precioPublico ?? 0 }));
}

export default function AdminImport() {
  const { data: listas }    = useCollection('t_listas', { orderField:'nombre', limitN:50 });
  const { data: productos } = useCollection('t_productos', { orderField:'nombre', limitN:300 });
  const toast = useToast();

  // Products import
  const [prodRows,    setProdRows]    = useState([]);
  const [prodFile,    setProdFile]    = useState('');
  const [importingP,  setImportingP]  = useState(false);
  const [resultP,     setResultP]     = useState(null);
  const prodRef = useRef();

  // Price list import
  const [precioRows,  setPrecioRows]  = useState([]);
  const [precioFile,  setPrecioFile]  = useState('');
  const [listaTarget, setListaTarget] = useState('');
  const [listaNombre, setListaNombre] = useState('');
  const [importingL,  setImportingL]  = useState(false);
  const [resultL,     setResultL]     = useState(null);
  const precioRef = useRef();

  // Product name → id map
  const prodNameMap = Object.fromEntries(
    productos.map(p => [p.nombre.toLowerCase().trim(), p.id])
  );

  // ── Read product file ──────────────────────────────────────────────────────
  const handleProdFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setProdFile(file.name);
    try {
      const rows = await parseFile(file);
      setProdRows(rows.map(norm));
      setResultP(null);
    } catch (err) { toast('Error al leer archivo: ' + err.message, 'error'); }
  };

  // ── Import products ────────────────────────────────────────────────────────
  const importarProductos = async () => {
    if (!prodRows.length) return;
    setImportingP(true);
    let ok = 0, skip = 0;
    try {
      for (const row of prodRows) {
        const nombre = (row.nombre || '').trim();
        if (!nombre) { skip++; continue; }
        await addDoc(collection(db, 't_productos'), {
          nombre,
          descripcion:   row.descripcion   || '',
          categoria:     row.categoria      || '',
          unidad:        row.unidad         || '',
          precioPublico: parseFloat(row.preciopublico || row.precio_publico || 0),
          precioGeneral: parseFloat(row.precioGeneral || row.precio_general || row.preciopublico || row.precio_publico || 0),
          emoji:         row.emoji          || '🌿',
          enStock:       true,
          activo:        true,
          creadoEn:      serverTimestamp(),
        });
        ok++;
      }
      setResultP({ ok, skip });
      toast(`✓ ${ok} productos importados`);
      setProdRows([]); setProdFile('');
      if (prodRef.current) prodRef.current.value = '';
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    } finally { setImportingP(false); }
  };

  // ── Read price file ────────────────────────────────────────────────────────
  const handlePrecioFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setPrecioFile(file.name);
    try {
      const rows = await parseFile(file);
      setPrecioRows(rows.map(norm));
      setResultL(null);
    } catch (err) { toast('Error al leer archivo: ' + err.message, 'error'); }
  };

  // ── Import price list ──────────────────────────────────────────────────────
  const importarPrecios = async () => {
    if (!precioRows.length) return;
    if (!listaTarget && !listaNombre.trim()) {
      toast('Seleccioná una lista existente o ingresá nombre para la nueva', 'warn'); return;
    }
    setImportingL(true);
    let ok = 0, noMatch = [];
    try {
      const items = [];
      for (const row of precioRows) {
        const nombre = (row.producto || row.nombre || '').trim();
        const precio = parseFloat(row.precio || 0);
        if (!nombre || !precio) continue;
        const prodId = prodNameMap[nombre.toLowerCase()] || null;
        if (!prodId) { noMatch.push(nombre); continue; }
        items.push({ productoId: prodId, precio });
        ok++;
      }

      if (listaTarget) {
        const snap = await getDocs(collection(db, 't_listas'));
        const listaDoc = snap.docs.find(d => d.id === listaTarget);
        const prevItems = listaDoc?.data()?.items || [];
        const merged = [...prevItems];
        for (const ni of items) {
          const idx = merged.findIndex(x => x.productoId === ni.productoId);
          if (idx >= 0) merged[idx] = ni; else merged.push(ni);
        }
        await setDoc(doc(db, 't_listas', listaTarget), { items: merged }, { merge: true });
        toast(`✓ ${ok} precios actualizados en "${listas.find(l => l.id === listaTarget)?.nombre}"`);
      } else {
        await addDoc(collection(db, 't_listas'), {
          nombre:      listaNombre.trim(),
          descripcion: '',
          items,
          creadoEn:    serverTimestamp(),
        });
        toast(`✓ Lista "${listaNombre.trim()}" creada con ${ok} precios`);
      }

      setResultL({ ok, noMatch });
      setPrecioRows([]); setPrecioFile(''); setListaNombre('');
      if (precioRef.current) precioRef.current.value = '';
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    } finally { setImportingL(false); }
  };

  return (
    <div style={{ maxWidth:900 }}>
      <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:G, marginBottom:6 }}>Carga Masiva</h1>
      <p style={{ fontSize:'.83rem', color:'#888', marginBottom:24 }}>
        Importá productos y listas de precio desde archivos <strong>Excel (.xlsx)</strong>.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>

        {/* ── Productos ── */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', padding:22 }}>
          <div style={{ fontWeight:700, color:G, marginBottom:14, fontSize:'.9rem', paddingBottom:10, borderBottom:'1px solid #F0F0EC' }}>
            📦 Importar Productos
          </div>

          <div style={{ marginBottom:14, padding:'12px 14px', background:'#F5F5F0', borderRadius:6, fontSize:'.8rem', color:'#555' }}>
            <div style={{ fontWeight:700, marginBottom:8 }}>Columnas del Excel:</div>
            <table style={{ width:'100%', fontSize:'.72rem', borderCollapse:'collapse' }}>
              <tbody>
                {[['Nombre *','Nombre del producto'],['Descripcion','Descripción corta'],['Categoria','Una de las categorías'],['Unidad','Unidad de venta'],['PrecioPublico *','Precio público (Q)'],['PrecioGeneral','Precio cliente general'],['Emoji','Emoji opcional 🥬']].map(([col, desc]) => (
                  <tr key={col}>
                    <td style={{ fontWeight:700, paddingRight:8, paddingBottom:4, whiteSpace:'nowrap', color:G }}>{col}</td>
                    <td style={{ color:'#888', paddingBottom:4 }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop:8, fontSize:'.7rem', color:'#888' }}>
              Categorías: {CATEGORIAS.join(' · ')}<br/>
              Unidades: {UNIDADES.join(' · ')}
            </div>
            <button onClick={() => downloadXLSX(TEMPLATE_PRODUCTOS, 'plantilla_productos.xlsx', 'Productos')}
              style={{ marginTop:10, padding:'6px 14px', background:G, color:'#fff', border:'none', borderRadius:4, fontSize:'.75rem', cursor:'pointer', fontWeight:600 }}>
              ⬇ Descargar plantilla Excel
            </button>
          </div>

          <input type="file" accept=".xlsx,.xls,.csv" ref={prodRef} onChange={handleProdFile}
            style={{ fontSize:'.8rem', marginBottom:10, width:'100%' }} />
          {prodFile && (
            <div style={{ fontSize:'.78rem', color:'#555', marginBottom:8 }}>
              📄 {prodFile} — {prodRows.length} filas detectadas
            </div>
          )}

          {prodRows.length > 0 && (
            <div style={{ background:'#F9F9F6', borderRadius:6, padding:10, marginBottom:12, maxHeight:160, overflowY:'auto', fontSize:'.75rem' }}>
              <div style={{ fontWeight:700, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>
                Vista previa ({Math.min(prodRows.length,5)} de {prodRows.length})
              </div>
              {prodRows.slice(0,5).map((r,i) => (
                <div key={i} style={{ display:'flex', gap:8, marginBottom:4, padding:'4px 0', borderBottom:'1px solid #F0F0EC' }}>
                  <span style={{ fontWeight:700, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {r.nombre}
                  </span>
                  <span style={{ color:'#888', whiteSpace:'nowrap' }}>{r.categoria}</span>
                  <span style={{ color:'#888', whiteSpace:'nowrap' }}>{r.unidad}</span>
                  <span style={{ color:'#2D6645', fontWeight:600, whiteSpace:'nowrap' }}>Q{r.preciopublico || r.precio_publico}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={importarProductos} disabled={!prodRows.length || importingP}
            style={{ width:'100%', padding:'10px', background: (!prodRows.length || importingP) ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: (!prodRows.length || importingP) ? 'not-allowed' : 'pointer' }}>
            {importingP ? 'Importando…' : `Importar ${prodRows.length} producto${prodRows.length !== 1 ? 's' : ''}`}
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
            💲 Actualizar Lista de Precios
          </div>

          <div style={{ marginBottom:14, padding:'12px 14px', background:'#F5F5F0', borderRadius:6, fontSize:'.8rem', color:'#555' }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Columnas del Excel:</div>
            <table style={{ width:'100%', fontSize:'.72rem', borderCollapse:'collapse' }}>
              <tbody>
                {[['Producto *','Nombre exacto del producto'],['Precio *','Precio negociado (Q)']].map(([col, desc]) => (
                  <tr key={col}>
                    <td style={{ fontWeight:700, paddingRight:8, paddingBottom:4, whiteSpace:'nowrap', color:G }}>{col}</td>
                    <td style={{ color:'#888', paddingBottom:4 }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop:6, color:'#888', fontSize:'.7rem' }}>
              El nombre de producto debe coincidir exactamente.
            </div>
            <button
              onClick={() => {
                const rows = makeTemplatePreciosXLSX(productos);
                if (!rows.length) { alert('Cargá productos primero'); return; }
                downloadXLSX(rows, 'plantilla_precios.xlsx', 'Precios');
              }}
              style={{ marginTop:10, padding:'6px 14px', background:G, color:'#fff', border:'none', borderRadius:4, fontSize:'.75rem', cursor:'pointer', fontWeight:600 }}>
              ⬇ Descargar Excel con tus productos
            </button>
          </div>

          {/* Target list */}
          <label style={LS}>
            Destino
            <select value={listaTarget} onChange={e => { setListaTarget(e.target.value); setListaNombre(''); }} style={IS}>
              <option value="">+ Crear nueva lista</option>
              {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </label>

          {!listaTarget && (
            <label style={LS}>
              Nombre de la nueva lista
              <input value={listaNombre} onChange={e => setListaNombre(e.target.value)}
                placeholder="Ej. Canal Moderno — Mar 2025"
                style={IS} />
            </label>
          )}

          <input type="file" accept=".xlsx,.xls,.csv" ref={precioRef} onChange={handlePrecioFile}
            style={{ fontSize:'.8rem', marginBottom:10, width:'100%' }} />
          {precioFile && (
            <div style={{ fontSize:'.78rem', color:'#555', marginBottom:8 }}>
              📄 {precioFile} — {precioRows.length} filas detectadas
            </div>
          )}

          {precioRows.length > 0 && (
            <div style={{ background:'#F9F9F6', borderRadius:6, padding:10, marginBottom:12, maxHeight:160, overflowY:'auto', fontSize:'.75rem' }}>
              <div style={{ fontWeight:700, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Vista previa</div>
              {precioRows.slice(0,5).map((r,i) => {
                const nombre = (r.producto || r.nombre || '').trim();
                const found  = !!prodNameMap[nombre.toLowerCase()];
                return (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', marginBottom:4, padding:'4px 0', borderBottom:'1px solid #F0F0EC' }}>
                    <span style={{ fontWeight:600, color: found ? '#1A1A18' : '#C62828' }}>
                      {found ? '✓' : '✗'} {nombre}
                    </span>
                    <span style={{ color:'#2D6645', fontWeight:700 }}>Q {r.precio}</span>
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={importarPrecios} disabled={!precioRows.length || importingL}
            style={{ width:'100%', padding:'10px', background: (!precioRows.length || importingL) ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: (!precioRows.length || importingL) ? 'not-allowed' : 'pointer' }}>
            {importingL ? 'Importando…' : `Importar ${precioRows.length} precio${precioRows.length !== 1 ? 's' : ''}`}
          </button>

          {resultL && (
            <div style={{ marginTop:10, padding:'10px 14px', background: resultL.noMatch.length ? '#FFF3E0' : '#E8F5E9', borderRadius:6, fontSize:'.8rem', color: resultL.noMatch.length ? '#E65100' : G }}>
              ✓ {resultL.ok} precios importados
              {resultL.noMatch.length > 0 && (
                <div style={{ marginTop:4 }}>⚠ Sin coincidencia: {resultL.noMatch.join(', ')}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Products reference */}
      {productos.length > 0 && (
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', padding:20, marginTop:24 }}>
          <div style={{ fontWeight:700, color:G, marginBottom:12, fontSize:'.83rem' }}>
            Productos cargados ({productos.length}) — referencia para el Excel de precios
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
