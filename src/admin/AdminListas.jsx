import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  db, collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp,
} from '../firebase.js';
import { useCollection } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtDate, today } from '../utils/format.js';

const G = '#1A3D28';
const thSt = { color:'#fff', padding:'8px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', background:G };
const tdSt = { padding:'8px 12px', fontSize:'.82rem', borderBottom:'1px solid #F0F0EC', verticalAlign:'middle' };
const IS   = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };
const LS   = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:10 };
const Btn  = (bg=G, c='#fff') => ({ padding:'7px 16px', background:bg, color:c, border:`1.5px solid ${bg==='transparent'?'#E0E0E0':bg}`, borderRadius:4, fontWeight:700, fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit' });
const BtnSm = (bg='transparent', c='#555', bc='#E0E0E0') => ({ padding:'4px 10px', background:bg, color:c, border:`1px solid ${bc}`, borderRadius:3, fontWeight:600, fontSize:'.72rem', cursor:'pointer', fontFamily:'inherit' });

const normStr = s => String(s||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');

export default function AdminListas() {
  const { data: listas,        loading: loadL } = useCollection('t_listas',        { orderField:'nombre', limitN:100 });
  const { data: productos,     loading: loadP } = useCollection('t_productos',      { orderField:'nombre', limitN:300 });
  const { data: presentaciones }                = useCollection('t_presentaciones', { orderField:'descripcion', limitN:500 });
  const { data: clientes }                      = useCollection('t_clientes',       { limitN:2000 });
  const toast = useToast();

  // ── view state ─────────────────────────────────────────────────────────────
  const [view, setView]               = useState('list'); // 'list' | 'edit' | 'new'
  const [selected, setSelected]       = useState(null);
  const [duplicadoDe, setDuplicadoDe] = useState(null);

  // form
  const [form, setForm] = useState({ nombre:'', descripcion:'', vigenciaDesde:'', vigenciaHasta:'', activa:true });
  const ef = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // items in edit
  const [items, setItems] = useState([]);

  // add-item row
  const [addProd,   setAddProd]   = useState('');
  const [addPres,   setAddPres]   = useState('');
  const [addPrecio, setAddPrecio] = useState('');

  // inline new presentation
  const [showNewPres,   setShowNewPres]   = useState(false);
  const [newPresDesc,   setNewPresDesc]   = useState('');
  const [newPresUnidad, setNewPresUnidad] = useState('');
  const [savingPres,    setSavingPres]    = useState(false);

  const [saving, setSaving] = useState(false);

  // excel import
  const [showImport,    setShowImport]    = useState(false);
  const [importTarget,  setImportTarget]  = useState('');
  const [importRows,    setImportRows]    = useState([]);
  const [importFile,    setImportFile]    = useState('');
  const [importingXlsx, setImportingXlsx] = useState(false);
  const fileRef = useRef();

  // ── Derived ────────────────────────────────────────────────────────────────
  const presByProd = useMemo(() =>
    addProd ? presentaciones.filter(p => p.productoId === addProd) : [],
    [presentaciones, addProd]
  );

  const clientesPorLista = useMemo(() => {
    const m = {};
    for (const c of clientes) {
      if (c.listaId && c.listaId !== 'general') m[c.listaId] = (m[c.listaId]||0)+1;
    }
    return m;
  }, [clientes]);

  const prodNombre = id => productos.find(p => p.id === id)?.nombre || '—';
  const presLabel  = id => {
    const p = presentaciones.find(p => p.id === id);
    return p ? `${p.descripcion} (${p.unidad||'—'})` : id;
  };

  const enriqueItems = raw => (raw||[]).map(i => {
    if (i.presentacionId) {
      return { ...i, _prodNombre: prodNombre(presentaciones.find(p => p.id === i.presentacionId)?.productoId), _presDesc: presLabel(i.presentacionId) };
    }
    // legacy: productoId only
    return { ...i, _prodNombre: prodNombre(i.productoId), _presDesc: '(sin presentación)' };
  });

  // ── Open edit ──────────────────────────────────────────────────────────────
  const openEdit = lista => {
    setSelected(lista);
    setDuplicadoDe(null);
    setForm({
      nombre:        lista.nombre         || '',
      descripcion:   lista.descripcion    || '',
      vigenciaDesde: lista.vigenciaDesde  || '',
      vigenciaHasta: lista.vigenciaHasta  || '',
      activa:        lista.activa !== false,
    });
    setItems(enriqueItems(lista.items));
    setView('edit');
    setAddProd(''); setAddPres(''); setAddPrecio('');
  };

  const openNew = () => {
    setSelected(null); setDuplicadoDe(null);
    setForm({ nombre:'', descripcion:'', vigenciaDesde:'', vigenciaHasta:'', activa:true });
    setItems([]);
    setView('new');
    setAddProd(''); setAddPres(''); setAddPrecio('');
  };

  const duplicar = lista => {
    setSelected(null);
    setDuplicadoDe(lista);
    setForm({ nombre:`${lista.nombre} — copia`, descripcion:lista.descripcion||'', vigenciaDesde:'', vigenciaHasta:'', activa:true });
    setItems(enriqueItems(lista.items));
    setView('new');
    setAddProd(''); setAddPres(''); setAddPrecio('');
  };

  // ── Add item ───────────────────────────────────────────────────────────────
  const handleAddItem = () => {
    if (!addProd)                                   { toast('Seleccioná producto', 'warn'); return; }
    if (presByProd.length > 0 && !addPres)          { toast('Seleccioná presentación', 'warn'); return; }
    if (!addPrecio || isNaN(parseFloat(addPrecio))) { toast('Ingresá precio', 'warn'); return; }
    setItems(prev => {
      if (addPres) {
        const idx = prev.findIndex(i => i.presentacionId === addPres);
        const entry = { presentacionId: addPres, precio: parseFloat(addPrecio), activo: true,
          _prodNombre: prodNombre(presentaciones.find(p => p.id === addPres)?.productoId),
          _presDesc:   presLabel(addPres) };
        if (idx >= 0) { const n=[...prev]; n[idx]=entry; return n; }
        return [...prev, entry];
      } else {
        // product without presentations → use productoId directly
        const idx = prev.findIndex(i => i.productoId === addProd && !i.presentacionId);
        const entry = { productoId: addProd, precio: parseFloat(addPrecio), activo: true,
          _prodNombre: prodNombre(addProd), _presDesc: '(sin presentación)' };
        if (idx >= 0) { const n=[...prev]; n[idx]=entry; return n; }
        return [...prev, entry];
      }
    });
    setAddProd(''); setAddPres(''); setAddPrecio('');
  };

  const handleCrearPresentacion = async () => {
    if (!addProd) { toast('Seleccioná producto primero', 'warn'); return; }
    if (!newPresDesc.trim()) { toast('Ingresá descripción', 'warn'); return; }
    setSavingPres(true);
    try {
      const ref = await addDoc(collection(db, 't_presentaciones'), {
        productoId:  addProd,
        descripcion: newPresDesc.trim(),
        unidad:      newPresUnidad.trim() || 'Unidad',
        activo:      true,
        creadoEn:    serverTimestamp(),
      });
      setAddPres(ref.id);
      setShowNewPres(false); setNewPresDesc(''); setNewPresUnidad('');
      toast('✓ Presentación creada');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { setSavingPres(false); }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.nombre.trim()) { toast('Ingresá nombre', 'warn'); return; }
    setSaving(true);
    try {
      const cleanItems = items.map(({ _prodNombre: _p, _presDesc: _d, ...rest }) => rest);
      const data = {
        nombre:        form.nombre.trim(),
        descripcion:   form.descripcion.trim(),
        vigenciaDesde: form.vigenciaDesde || null,
        vigenciaHasta: form.vigenciaHasta || null,
        activa:        form.activa,
        items:         cleanItems,
        actualizadaEn: serverTimestamp(),
      };

      if (selected) {
        await updateDoc(doc(db, 't_listas', selected.id), data);
        toast('✓ Lista actualizada');
      } else {
        const newRef = await addDoc(collection(db, 't_listas'), { ...data, creadaEn: serverTimestamp() });
        if (duplicadoDe) {
          const snap = await getDocs(query(collection(db, 't_clientes'), where('listaId', '==', duplicadoDe.id)));
          if (snap.size > 0) {
            const ok = window.confirm(`¿Migrar ${snap.size} cliente(s) de "${duplicadoDe.nombre}" a esta nueva lista?`);
            if (ok) {
              await Promise.all(snap.docs.map(d => updateDoc(doc(db, 't_clientes', d.id), { listaId: newRef.id })));
              toast(`✓ Lista creada · ${snap.size} cliente(s) migrados`);
            } else { toast('✓ Lista creada'); }
          } else { toast('✓ Lista creada'); }
        } else { toast('✓ Lista creada'); }
      }
      setView('list');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async lista => {
    const asignados = clientes.filter(c => c.listaId === lista.id);
    const msg = asignados.length > 0
      ? `¿Eliminar "${lista.nombre}"? ${asignados.length} cliente(s) volverán a lista General.`
      : `¿Eliminar lista "${lista.nombre}"?`;
    if (!window.confirm(msg)) return;
    try {
      if (asignados.length > 0)
        await Promise.all(asignados.map(c => updateDoc(doc(db, 't_clientes', c.id), { listaId:'general' })));
      await deleteDoc(doc(db, 't_listas', lista.id));
      toast('✓ Lista eliminada');
      if (view !== 'list') setView('list');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  // ── Excel import ───────────────────────────────────────────────────────────
  const prodNameMap = useMemo(() =>
    Object.fromEntries(productos.map(p => [normStr(p.nombre), p.id])),
    [productos]
  );

  const handleImportFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      setImportRows(XLSX.utils.sheet_to_json(ws, { defval:'' }));
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSave = async () => {
    if (!importTarget)    { toast('Seleccioná lista destino', 'warn'); return; }
    if (!importRows.length){ toast('Cargá archivo Excel', 'warn'); return; }
    setImportingXlsx(true);
    let ok = 0; const noMatch = [];
    try {
      const newItems = [];
      for (const row of importRows) {
        const nombreRaw  = String(row.Producto||row.producto||row.Nombre||row.nombre||'').trim();
        const presRaw    = String(row.Presentacion||row.presentacion||row['Presentación']||'').trim();
        const precio     = parseFloat(row.Precio||row.precio||0);
        if (!nombreRaw || !precio) continue;

        const prodId = prodNameMap[normStr(nombreRaw)] || null;
        if (!prodId) { noMatch.push(nombreRaw); continue; }

        let presId = null;
        if (presRaw) {
          presId = presentaciones.find(p => p.productoId === prodId && normStr(p.descripcion) === normStr(presRaw))?.id || null;
        } else {
          presId = presentaciones.find(p => p.productoId === prodId)?.id || null;
        }
        if (!presId) {
          // no presentations → add with productoId directly
          newItems.push({ productoId: prodId, precio, activo: true });
          ok++;
          continue;
        }

        newItems.push({ presentacionId: presId, precio, activo: true });
        ok++;
      }

      if (!newItems.length) { toast('Sin coincidencias en el Excel', 'warn'); return; }

      const snap      = await getDocs(query(collection(db, 't_listas')));
      const listaDoc  = snap.docs.find(d => d.id === importTarget);
      const prevItems = listaDoc?.data()?.items || [];
      const merged    = [...prevItems];
      for (const ni of newItems) {
        const idx = ni.presentacionId
          ? merged.findIndex(x => x.presentacionId === ni.presentacionId)
          : merged.findIndex(x => x.productoId === ni.productoId && !x.presentacionId);
        if (idx >= 0) merged[idx] = ni; else merged.push(ni);
      }
      await updateDoc(doc(db, 't_listas', importTarget), { items: merged, actualizadaEn: serverTimestamp() });
      const warnMsg = noMatch.length ? ` · Sin match: ${noMatch.slice(0,3).join(', ')}${noMatch.length>3?'…':''}` : '';
      toast(`✓ ${ok} precios importados${warnMsg}`);
      setImportRows([]); setImportFile(''); setShowImport(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { setImportingXlsx(false); }
  };

  const downloadTemplate = () => {
    const rows = [];
    for (const prod of productos.slice(0, 30)) {
      const pres = presentaciones.filter(p => p.productoId === prod.id);
      if (pres.length) {
        for (const p of pres) rows.push({ Producto: prod.nombre, Presentacion: p.descripcion, Precio: '' });
      } else {
        rows.push({ Producto: prod.nombre, Presentacion: '', Precio: '' });
      }
    }
    if (!rows.length) { alert('Sin productos aún'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:30 },{ wch:24 },{ wch:12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precios');
    XLSX.writeFile(wb, 'plantilla_precios.xlsx');
  };

  const vigenciaLabel = l => {
    if (!l.vigenciaDesde && !l.vigenciaHasta) return 'Sin vencimiento';
    return `${l.vigenciaDesde ? fmtDate(l.vigenciaDesde) : '—'} → ${l.vigenciaHasta ? fmtDate(l.vigenciaHasta) : '∞'}`;
  };
  const vencida = l => l.vigenciaHasta && l.vigenciaHasta < today();

  if (loadL || loadP) return <div style={{ padding:40, color:'#888', textAlign:'center' }}>Cargando…</div>;

  // ── EDIT / NEW ─────────────────────────────────────────────────────────────
  if (view === 'edit' || view === 'new') {
    const isEdit      = view === 'edit';
    const nClientes   = isEdit ? (clientesPorLista[selected?.id] || 0) : 0;
    const isDuplicate = !isEdit && !!duplicadoDe;

    return (
      <div style={{ maxWidth:920 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={() => setView('list')} style={BtnSm()}>← Volver</button>
          <h1 style={{ fontSize:'1.1rem', fontWeight:800, color:G, margin:0 }}>
            {isEdit ? `Editar: ${selected.nombre}` : isDuplicate ? `Duplicar: ${duplicadoDe.nombre}` : 'Nueva lista de precios'}
          </h1>
        </div>

        {isEdit && nClientes > 0 && (
          <div style={{ background:'#E3F2FD', border:'1px solid #BBDEFB', borderRadius:6, padding:'10px 16px', marginBottom:16, fontSize:'.82rem', color:'#1565C0' }}>
            <strong>{nClientes} cliente{nClientes!==1?'s':''}</strong> usan esta lista — los precios se actualizarán inmediatamente al guardar.
          </div>
        )}
        {isDuplicate && (
          <div style={{ background:'#FFF9C4', border:'1px solid #F9A825', borderRadius:6, padding:'10px 16px', marginBottom:16, fontSize:'.82rem', color:'#E65100' }}>
            Al guardar se preguntará si migrar los clientes de <strong>{duplicadoDe.nombre}</strong> a esta nueva lista.
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <label style={LS}>Nombre <input value={form.nombre} onChange={e => ef('nombre', e.target.value)} style={IS} placeholder="Ej. Canal Moderno — Q2 2026" /></label>
          <label style={LS}>Descripción <input value={form.descripcion} onChange={e => ef('descripcion', e.target.value)} style={IS} placeholder="Notas opcionales" /></label>
          <label style={LS}>Vigencia desde <input type="date" value={form.vigenciaDesde} onChange={e => ef('vigenciaDesde', e.target.value)} style={IS} /></label>
          <label style={LS}>Vigencia hasta <input type="date" value={form.vigenciaHasta} onChange={e => ef('vigenciaHasta', e.target.value)} style={IS} /></label>
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.83rem', margin:'8px 0 20px', cursor:'pointer' }}>
          <input type="checkbox" checked={form.activa} onChange={e => ef('activa', e.target.checked)} />
          Lista activa
        </label>

        {/* Items */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflow:'hidden' }}>
          <div style={{ background:G, color:'#F5F0E4', padding:'10px 16px', fontWeight:700, fontSize:'.83rem' }}>
            Productos en esta lista ({items.length})
          </div>

          {items.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Producto','Presentación','Precio (Q)','Activo',''].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.presentacionId || item.productoId || idx} style={{ background: idx%2 ? '#F9F9F6' : '#fff' }}>
                    <td style={tdSt}><span style={{ fontWeight:600 }}>{item._prodNombre}</span></td>
                    <td style={{ ...tdSt, color:'#888' }}>{item._presDesc}</td>
                    <td style={tdSt}>
                      <input type="number" min={0} value={item.precio}
                        onChange={e => { const n=[...items]; n[idx]={...n[idx],precio:parseFloat(e.target.value)||0}; setItems(n); }}
                        style={{ width:80, padding:'4px 8px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit' }}
                      />
                    </td>
                    <td style={tdSt}>
                      <input type="checkbox" checked={item.activo!==false}
                        onChange={e => { const n=[...items]; n[idx]={...n[idx],activo:e.target.checked}; setItems(n); }}
                      />
                    </td>
                    <td style={tdSt}>
                      <button onClick={() => setItems(it => it.filter((_,i) => i!==idx))} style={BtnSm('transparent','#C62828','#C62828')}>Quitar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Add item */}
          <div style={{ padding:'14px 16px', borderTop: items.length?'2px solid #F0F0EC':'none', background:'#FDFCF8' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:8 }}>Agregar producto</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
              <label style={{ ...LS, marginBottom:0, flex:'2 1 160px' }}>
                Producto
                <select value={addProd} onChange={e => { setAddProd(e.target.value); setAddPres(''); }} style={IS}>
                  <option value="">— Seleccionar —</option>
                  {productos.filter(p => p.activo!==false).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              <label style={{ ...LS, marginBottom:0, flex:'2 1 160px' }}>
                Presentación
                {addProd && presByProd.length === 0
                  ? <div style={{ marginTop:4, padding:'7px 10px', background:'#FFF9C4', borderRadius:4, fontSize:'.75rem', color:'#795548', border:'1.5px solid #F9A825' }}>Sin presentaciones — se agrega el producto directo</div>
                  : <select value={addPres} onChange={e => setAddPres(e.target.value)} style={IS} disabled={!addProd}>
                      <option value="">— Seleccionar —</option>
                      {presByProd.map(p => <option key={p.id} value={p.id}>{p.descripcion} ({p.unidad})</option>)}
                    </select>
                }
              </label>
              <label style={{ ...LS, marginBottom:0, width:100, flexShrink:0 }}>
                Precio (Q)
                <input type="number" min={0} value={addPrecio} onChange={e => setAddPrecio(e.target.value)} style={IS} placeholder="0.00" />
              </label>
              <button onClick={handleAddItem} style={{ ...Btn(), marginBottom:1 }}>+ Agregar</button>
              {addProd && (
                <button onClick={() => setShowNewPres(v => !v)} style={{ ...BtnSm(), marginBottom:1 }}>
                  {showNewPres ? 'Cancelar' : '+ Nueva presentación'}
                </button>
              )}
            </div>

            {showNewPres && addProd && (
              <div style={{ marginTop:10, padding:'12px 14px', background:'#E8F5E9', borderRadius:6, display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:G, width:'100%', marginBottom:2 }}>
                  Nueva presentación para: <strong>{prodNombre(addProd)}</strong>
                </div>
                <label style={{ ...LS, marginBottom:0, flex:'2 1 140px' }}>
                  Descripción <input value={newPresDesc} onChange={e => setNewPresDesc(e.target.value)} style={IS} placeholder="Ej. Caja 4 unidades" />
                </label>
                <label style={{ ...LS, marginBottom:0, width:120, flexShrink:0 }}>
                  Unidad <input value={newPresUnidad} onChange={e => setNewPresUnidad(e.target.value)} style={IS} placeholder="Caja" />
                </label>
                <button onClick={handleCrearPresentacion} disabled={savingPres} style={{ ...Btn(savingPres?'#ccc':G), marginBottom:1 }}>
                  {savingPres ? 'Guardando…' : 'Crear'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:20, flexWrap:'wrap' }}>
          <button onClick={handleSave} disabled={saving} style={{ ...Btn(saving?'#ccc':G), padding:'10px 24px' }}>
            {saving ? 'Guardando…' : '✓ Guardar lista'}
          </button>
          <button onClick={() => setView('list')} style={Btn('transparent')}>Cancelar</button>
          {isEdit && (
            <button onClick={() => handleDelete(selected)} style={{ ...Btn('transparent','#C62828'), border:'1.5px solid #C62828', marginLeft:'auto' }}>
              Eliminar lista
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:960 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:G, margin:0 }}>Listas de precio ({listas.length})</h1>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => { setShowImport(v => !v); }} style={BtnSm()}>
            {showImport ? 'Cerrar importar' : '⬆ Importar Excel'}
          </button>
          <button onClick={openNew} style={Btn()}>+ Nueva lista</button>
        </div>
      </div>

      {showImport && (
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', padding:20, marginBottom:20 }}>
          <div style={{ fontWeight:700, color:G, marginBottom:10, fontSize:'.85rem' }}>Importar precios desde Excel</div>
          <div style={{ fontSize:'.78rem', color:'#888', marginBottom:12 }}>
            Columnas: <strong>Producto</strong> | <strong>Presentacion</strong> | <strong>Precio</strong> · El nombre se normaliza (sin tildes, case insensitive)
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
            <label style={{ ...LS, marginBottom:0, flex:'2 1 200px' }}>
              Lista destino
              <select value={importTarget} onChange={e => setImportTarget(e.target.value)} style={IS}>
                <option value="">— Seleccionar —</option>
                {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </label>
            <div>
              <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={handleImportFile} style={{ fontSize:'.8rem' }} />
              {importFile && <div style={{ fontSize:'.72rem', color:'#888', marginTop:2 }}>{importFile} — {importRows.length} filas</div>}
            </div>
            <button onClick={downloadTemplate} style={BtnSm()}>⬇ Plantilla</button>
            <button onClick={handleImportSave}
              disabled={importingXlsx || !importTarget || !importRows.length}
              style={Btn(importingXlsx||!importTarget||!importRows.length?'#ccc':G)}>
              {importingXlsx ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>{['Nombre','Vigencia','Productos','Clientes','Estado','Acciones'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {listas.map((l, i) => {
              const expired = vencida(l);
              const nc = clientesPorLista[l.id] || 0;
              return (
                <tr key={l.id} style={{ background: i%2 ? '#F9F9F6' : '#fff' }}>
                  <td style={tdSt}>
                    <div style={{ fontWeight:700, fontSize:'.85rem', color:G }}>{l.nombre}</div>
                    {l.descripcion && <div style={{ fontSize:'.72rem', color:'#888' }}>{l.descripcion}</div>}
                  </td>
                  <td style={{ ...tdSt, fontSize:'.78rem', color: expired?'#C62828':'#555' }}>
                    {vigenciaLabel(l)}
                    {expired && <span style={{ fontSize:'.68rem', fontWeight:700, color:'#C62828', marginLeft:6 }}>VENCIDA</span>}
                  </td>
                  <td style={{ ...tdSt, textAlign:'center', fontWeight:700, color:'#555' }}>{(l.items||[]).length}</td>
                  <td style={{ ...tdSt, textAlign:'center', fontWeight:700, color: nc?G:'#ccc' }}>{nc}</td>
                  <td style={tdSt}>
                    <span style={{ fontSize:'.72rem', fontWeight:700, color: l.activa!==false?'#1B5E20':'#C62828' }}>
                      {l.activa!==false ? '● Activa' : '○ Inactiva'}
                    </span>
                  </td>
                  <td style={{ ...tdSt }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => openEdit(l)} style={BtnSm('#E8F5E9',G,G)}>Editar</button>
                      <button onClick={() => duplicar(l)} style={BtnSm()}>Duplicar</button>
                      <button onClick={() => handleDelete(l)} style={BtnSm('transparent','#C62828','#C62828')}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!listas.length && (
              <tr><td colSpan={6} style={{ ...tdSt, textAlign:'center', color:'#aaa', padding:40 }}>Sin listas — crea la primera</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
