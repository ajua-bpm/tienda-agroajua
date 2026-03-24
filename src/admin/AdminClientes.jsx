import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../hooks/useFirestore.js';
import { useToast } from '../components/Toast.jsx';
import { fmtDate, fmtQ, today } from '../utils/format.js';
import Badge from '../components/Badge.jsx';
import { TIPOS_NEGOCIO } from '../utils/catalogos.js';
import { nextClienteCodigo } from '../utils/correlativo.js';

const G = '#1A3D28';
const thSt = { color:'#fff', padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textAlign:'left', textTransform:'uppercase', background:G };
const tdSt = { padding:'9px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0EC', verticalAlign:'middle' };
const IS   = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };
const LS   = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:10 };
const BtnSm = (bg='transparent', c='#555', bc='#E0E0E0') => ({ padding:'5px 12px', background:bg, color:c, border:`1px solid ${bc}`, borderRadius:3, fontWeight:600, fontSize:'.72rem', cursor:'pointer', fontFamily:'inherit' });
const DIAS_CREDITO = [0, 15, 30, 45, 60, 90];
const TIER_LABEL   = { publico:'Público', general:'General', negociado:'Negociado' };
const TIER_COLOR   = { publico:{bg:'#F5F5F5',color:'#555'}, general:{bg:'#E8F5E9',color:'#1B5E20'}, negociado:{bg:'#FFF3E0',color:'#E65100'} };

export default function AdminClientes() {
  const { data: clientes, loading } = useCollection('t_clientes', { limitN:500 });
  const { data: listas }            = useCollection('t_listas',   { orderField:'nombre', limitN:50 });
  const { data: ordenes }           = useCollection('t_ordenes',  { orderField:'creadoEn', orderDir:'desc', limitN:2000 });
  const { update } = useWrite('t_clientes');
  const toast = useToast();

  const [busqueda,   setBusqueda]   = useState('');
  const [filtroTier, setFiltroTier] = useState('');
  const [selected,   setSelected]   = useState(null);
  const [tab,        setTab]        = useState('info');
  const [editForm,   setEditForm]   = useState({});
  const [saving,     setSaving]     = useState(false);
  const [editSuc,    setEditSuc]    = useState(null);
  const [newSuc,     setNewSuc]     = useState(null);

  const ordenesMap = useMemo(() => {
    const m = {};
    for (const o of ordenes) {
      const key = o.clienteId || o.clienteUid;
      if (!key) continue;
      if (!m[key]) m[key] = [];
      m[key].push(o);
    }
    return m;
  }, [ordenes]);

  const filtrados = useMemo(() => {
    let list = clientes;
    if (filtroTier) list = list.filter(c => c.tier === filtroTier);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(c =>
        c.nombre?.toLowerCase().includes(q)  ||
        c.email?.toLowerCase().includes(q)   ||
        c.empresa?.toLowerCase().includes(q) ||
        c.codigo?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  }, [clientes, busqueda, filtroTier]);

  const statsCliente = useMemo(() => {
    const s = {};
    for (const [key, ords] of Object.entries(ordenesMap)) {
      const pendiente = ords.filter(o => ['entregada','facturada'].includes(o.estado)).reduce((sum,o) => sum+(o.total||0), 0);
      s[key] = { nOrdenes: ords.length, pendiente };
    }
    return s;
  }, [ordenesMap]);

  const openDetail = c => {
    setSelected(c); setTab('info');
    setEditForm({
      nombre:      c.nombre      || '',
      empresa:     c.empresa     || '',
      tipo:        c.tipo        || 'individual',
      tipoNegocio: c.tipoNegocio || '',
      telefono:    c.telefono    || '',
      nit:         c.nit         || '',
      tier:        c.tier        || 'general',
      listaId:     c.listaId     || 'general',
      diasCredito: c.diasCredito ?? 0,
      activo:      c.activo !== false,
      rol:         c.rol         || '',
    });
    setEditSuc(null); setNewSuc(null);
  };

  const ef = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      let extra = {};
      if (!selected.codigo) extra = { codigo: await nextClienteCodigo() };
      await update(selected.id, { ...editForm, ...extra });
      toast('✓ Cliente actualizado');
      setSelected(s => ({ ...s, ...editForm, ...extra }));
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleSaveSuc = async suc => {
    const sucursales = [...(selected.sucursales||[])];
    const idx = sucursales.findIndex(s => s.id === suc.id);
    if (idx >= 0) sucursales[idx] = suc;
    else sucursales.push({ ...suc, id: suc.id || String(Date.now()) });
    await update(selected.id, { sucursales });
    setSelected(s => ({ ...s, sucursales }));
    setEditSuc(null); setNewSuc(null);
    toast('✓ Sucursal guardada');
  };

  const handleDeleteSuc = async sucId => {
    if (!window.confirm('¿Eliminar esta sucursal?')) return;
    const sucursales = (selected.sucursales||[]).filter(s => s.id !== sucId);
    await update(selected.id, { sucursales });
    setSelected(s => ({ ...s, sucursales }));
    toast('✓ Sucursal eliminada');
  };

  const clientOrdenes = useMemo(() =>
    selected ? (ordenesMap[selected.id]||[]).slice(0,30) : [],
    [selected, ordenesMap]
  );

  const saldoInfo = useMemo(() => {
    if (!selected) return null;
    const ords       = ordenesMap[selected.id] || [];
    const pendientes = ords.filter(o => ['entregada','facturada'].includes(o.estado));
    const saldo      = pendientes.reduce((s,o) => s+(o.total||0), 0);
    const saldoVenc  = pendientes.filter(o => o.fechaPagoPromesada && o.fechaPagoPromesada < today()).reduce((s,o) => s+(o.total||0), 0);
    const proxima    = [...pendientes].sort((a,b) => (a.fechaPagoPromesada||'z').localeCompare(b.fechaPagoPromesada||'z'))[0];
    return { saldo, saldoVenc, proxima, pendientes };
  }, [selected, ordenesMap]);

  const calData = useMemo(() => {
    if (!selected) return {};
    const evs = {};
    for (const o of (ordenesMap[selected.id]||[])) {
      if (o.fechaEntregaPromesada) {
        if (!evs[o.fechaEntregaPromesada]) evs[o.fechaEntregaPromesada] = [];
        evs[o.fechaEntregaPromesada].push({ tipo:'entrega', o });
      }
      if (o.fechaPagoPromesada && ['entregada','facturada'].includes(o.estado)) {
        if (!evs[o.fechaPagoPromesada]) evs[o.fechaPagoPromesada] = [];
        evs[o.fechaPagoPromesada].push({ tipo:'pago', o });
      }
    }
    return evs;
  }, [selected, ordenesMap]);

  return (
    <div>
      <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:G, marginBottom:18 }}>Clientes ({clientes.length})</h1>

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar nombre, email, empresa, código…"
          style={{ padding:'8px 12px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:280 }} />
        <select value={filtroTier} onChange={e => setFiltroTier(e.target.value)}
          style={{ padding:'8px 12px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.83rem', outline:'none', fontFamily:'inherit' }}>
          <option value="">Todos los tiers</option>
          {Object.entries(TIER_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ fontSize:'.8rem', color:'#888' }}>{filtrados.length} resultado{filtrados.length!==1?'s':''}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected?'1fr 400px':'1fr', gap:20, alignItems:'start' }}>

        {/* Table */}
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Código','Nombre / Email','Empresa','Tier','Lista','Pedidos','Saldo','Estado',''].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ ...tdSt, textAlign:'center', color:'#888' }}>Cargando…</td></tr>}
              {filtrados.map((c, i) => {
                const { bg, color } = TIER_COLOR[c.tier] || {};
                const stats = statsCliente[c.id] || {};
                const listaEnc = listas.find(l => l.id === c.listaId);
                const listaLabel = !c.listaId || c.listaId==='general' ? 'General' : listaEnc?.nombre || '⚠ Eliminada';
                const listaRojo  = !listaEnc && c.listaId && c.listaId!=='general';
                return (
                  <tr key={c.id} onClick={() => openDetail(c)}
                    style={{ background: selected?.id===c.id?'#E8F5E9':i%2?'#F9F9F6':'#fff', cursor:'pointer' }}>
                    <td style={{ ...tdSt, color:'#888', fontSize:'.75rem', fontFamily:'monospace' }}>{c.codigo||'—'}</td>
                    <td style={tdSt}>
                      <div style={{ fontWeight:700, fontSize:'.83rem' }}>{c.nombre||'—'}</div>
                      <div style={{ fontSize:'.72rem', color:'#888' }}>{c.email}</div>
                      {c.rol==='admin' && <span style={{ fontSize:'.65rem', background:'#E8F5E9', color:G, borderRadius:3, padding:'1px 5px', fontWeight:700 }}>ADMIN</span>}
                    </td>
                    <td style={{ ...tdSt, color:'#888', fontSize:'.8rem' }}>
                      <div>{c.empresa||'—'}</div>
                      {c.tipoNegocio && <div style={{ fontSize:'.68rem', color:'#4A9E6A', fontWeight:600 }}>{c.tipoNegocio}</div>}
                    </td>
                    <td style={tdSt}><Badge label={TIER_LABEL[c.tier]||c.tier||'General'} bg={bg} color={color} /></td>
                    <td style={{ ...tdSt, fontSize:'.78rem', color:listaRojo?'#E65100':'#555', fontWeight:listaRojo?700:400 }}>{listaLabel}</td>
                    <td style={{ ...tdSt, textAlign:'center', fontWeight:700, color: stats.nOrdenes?G:'#ccc' }}>{stats.nOrdenes||0}</td>
                    <td style={{ ...tdSt, fontSize:'.78rem', fontWeight:700, color: stats.pendiente>0?'#E65100':'#ccc' }}>
                      {stats.pendiente>0 ? fmtQ(stats.pendiente) : '—'}
                    </td>
                    <td style={tdSt}>
                      <span style={{ fontSize:'.7rem', fontWeight:700, color: c.activo!==false?'#1B5E20':'#C62828' }}>
                        {c.activo!==false ? '● Activo' : '○ Inactivo'}
                      </span>
                    </td>
                    <td style={{ ...tdSt, color:'#4A9E6A', fontSize:'.75rem', fontWeight:600 }}>Ver →</td>
                  </tr>
                );
              })}
              {!loading && !filtrados.length && (
                <tr><td colSpan={9} style={{ ...tdSt, textAlign:'center', color:'#888', padding:40 }}>Sin clientes</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', position:'sticky', top:24, maxHeight:'88vh', overflowY:'auto' }}>
            <div style={{ background:G, color:'#F5F0E4', padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'8px 8px 0 0' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:'.9rem' }}>{selected.nombre||'Cliente'}</div>
                <div style={{ fontSize:'.72rem', opacity:.7 }}>{selected.codigo||''}{selected.codigo?' · ':''}{selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#F5F0E4', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'2px solid #F0F0EC' }}>
              {[['info','Datos'],['sucursales','Sucursales'],['financiero','Financiero'],['calendario','Calendario']].map(([t,l]) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex:1, padding:'9px 4px', border:'none', cursor:'pointer', fontFamily:'inherit',
                  fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em',
                  background:tab===t?'#fff':'#F5F5F0', color:tab===t?G:'#888',
                  borderBottom:tab===t?`2px solid ${G}`:'2px solid transparent', marginBottom:-2,
                }}>{l}</button>
              ))}
            </div>

            <div style={{ padding:16 }}>
              {/* INFO */}
              {tab==='info' && (
                <div>
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    {[['individual','Individual'],['negocio','Negocio']].map(([val,lbl]) => (
                      <button key={val} onClick={() => ef('tipo', val)} style={{
                        flex:1, padding:'6px', border:`2px solid ${editForm.tipo===val?G:'#E0E0E0'}`,
                        borderRadius:5, background:editForm.tipo===val?'#E8F5E9':'#fff',
                        color:editForm.tipo===val?G:'#888', fontWeight:editForm.tipo===val?700:500,
                        fontSize:'.75rem', cursor:'pointer',
                      }}>{lbl}</button>
                    ))}
                  </div>
                  {editForm.tipo==='negocio' && (
                    <label style={LS}>Tipo de negocio
                      <select value={editForm.tipoNegocio} onChange={e => ef('tipoNegocio', e.target.value)} style={IS}>
                        <option value="">— Seleccionar —</option>
                        {TIPOS_NEGOCIO.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                  )}
                  <label style={LS}>Nombre <input value={editForm.nombre} onChange={e => ef('nombre', e.target.value)} style={IS} /></label>
                  <label style={LS}>Empresa <input value={editForm.empresa} onChange={e => ef('empresa', e.target.value)} style={IS} /></label>
                  <label style={LS}>NIT <input value={editForm.nit} onChange={e => ef('nit', e.target.value)} placeholder="CF" style={IS} /></label>
                  <label style={LS}>Teléfono <input value={editForm.telefono} onChange={e => ef('telefono', e.target.value)} style={IS} /></label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 10px' }}>
                    <label style={LS}>Tier
                      <select value={editForm.tier} onChange={e => ef('tier', e.target.value)} style={IS}>
                        {Object.entries(TIER_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label style={LS}>Días de crédito
                      <select value={editForm.diasCredito} onChange={e => ef('diasCredito', parseInt(e.target.value))} style={IS}>
                        {DIAS_CREDITO.map(d => <option key={d} value={d}>{d===0?'Contado':`${d} días`}</option>)}
                      </select>
                    </label>
                  </div>
                  <label style={LS}>Lista de precios
                    <select value={editForm.listaId} onChange={e => ef('listaId', e.target.value)}
                      style={{ ...IS, borderColor:editForm.listaId!=='general'?G:'#E0E0E0' }}>
                      <option value="general">General (pública)</option>
                      {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </label>
                  <div style={{ display:'flex', gap:14, fontSize:'.83rem', marginBottom:14 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                      <input type="checkbox" checked={editForm.activo} onChange={e => ef('activo', e.target.checked)} /> Activo
                    </label>
                    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                      <input type="checkbox" checked={editForm.rol==='admin'} onChange={e => ef('rol', e.target.checked?'admin':'')} /> Admin
                    </label>
                  </div>
                  <button onClick={handleSave} disabled={saving}
                    style={{ width:'100%', padding:'10px', background:saving?'#ccc':G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor:saving?'not-allowed':'pointer' }}>
                    {saving ? 'Guardando…' : '✓ Guardar cambios'}
                  </button>
                </div>
              )}

              {/* SUCURSALES */}
              {tab==='sucursales' && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <SectionHdr>Puntos de entrega ({(selected.sucursales||[]).length})</SectionHdr>
                    <button onClick={() => setNewSuc({ id:String(Date.now()), nombre:'', contacto:'', telefono:'', email:'', direccion:'', activa:true })}
                      style={BtnSm('#E8F5E9',G,G)}>+ Agregar</button>
                  </div>
                  {(selected.sucursales||[]).map(s => (
                    <div key={s.id} style={{ background:'#F5F5F0', borderRadius:6, padding:'10px 12px', marginBottom:8 }}>
                      {editSuc?.id===s.id ? (
                        <SucursalForm value={editSuc} onChange={setEditSuc} onSave={() => handleSaveSuc(editSuc)} onCancel={() => setEditSuc(null)} />
                      ) : (
                        <div>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontWeight:700, color:G, fontSize:'.83rem' }}>{s.nombre}</span>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={() => setEditSuc({...s})} style={BtnSm()}>Editar</button>
                              <button onClick={() => handleDeleteSuc(s.id)} style={BtnSm('transparent','#C62828','#C62828')}>Eliminar</button>
                            </div>
                          </div>
                          {s.contacto && <div style={{ fontSize:'.78rem', color:'#555', marginTop:3 }}>{s.contacto}{s.telefono?` · ${s.telefono}`:''}</div>}
                          {s.direccion && <div style={{ fontSize:'.75rem', color:'#888', marginTop:2 }}>{s.direccion}</div>}
                          {s.activa===false && <span style={{ fontSize:'.65rem', color:'#C62828', fontWeight:700 }}>INACTIVA</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  {newSuc && (
                    <div style={{ background:'#E8F5E9', borderRadius:6, padding:'10px 12px', marginTop:8 }}>
                      <SectionHdr style={{ color:G, marginBottom:8 }}>Nueva sucursal</SectionHdr>
                      <SucursalForm value={newSuc} onChange={setNewSuc} onSave={() => handleSaveSuc(newSuc)} onCancel={() => setNewSuc(null)} />
                    </div>
                  )}
                  {!(selected.sucursales||[]).length && !newSuc && <Empty>Sin sucursales registradas</Empty>}
                </div>
              )}

              {/* FINANCIERO */}
              {tab==='financiero' && saldoInfo && (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                    <StatCard label="Saldo pendiente" value={fmtQ(saldoInfo.saldo)} color={saldoInfo.saldo>0?'#E65100':G} />
                    <StatCard label="Saldo vencido" value={fmtQ(saldoInfo.saldoVenc)} color={saldoInfo.saldoVenc>0?'#C62828':G} />
                    <StatCard label="Total pedidos" value={statsCliente[selected.id]?.nOrdenes||0} />
                    <StatCard label="Crédito" value={selected.diasCredito===0?'Contado':`${selected.diasCredito} días`} />
                  </div>
                  {saldoInfo.proxima && (
                    <div style={{ background:'#FFF3E0', border:'1px solid #FFB74D', borderRadius:6, padding:'10px 14px', marginBottom:14, fontSize:'.82rem' }}>
                      <span style={{ fontWeight:700, color:'#E65100' }}>Próximo pago: </span>
                      {saldoInfo.proxima.correlativo} · {fmtQ(saldoInfo.proxima.total)} · vence {fmtDate(saldoInfo.proxima.fechaPagoPromesada)}
                    </div>
                  )}
                  <SectionHdr>Saldo pendiente ({saldoInfo.pendientes.length})</SectionHdr>
                  {!saldoInfo.pendientes.length && <Empty>Sin saldo pendiente</Empty>}
                  {saldoInfo.pendientes.map(o => {
                    const venc = o.fechaPagoPromesada && o.fechaPagoPromesada < today();
                    return (
                      <div key={o.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #F5F5F0', fontSize:'.8rem' }}>
                        <div><span style={{ fontWeight:700, color:G }}>{o.correlativo}</span>
                          {o.fechaPagoPromesada && <span style={{ color:venc?'#C62828':'#888', marginLeft:8 }}>vence {fmtDate(o.fechaPagoPromesada)}{venc?' ⚠':''}</span>}
                        </div>
                        <span style={{ fontWeight:700, color:venc?'#C62828':'#2D6645' }}>{fmtQ(o.total)}</span>
                      </div>
                    );
                  })}
                  <SectionHdr style={{ marginTop:14 }}>Historial de pagos</SectionHdr>
                  {!clientOrdenes.filter(o => o.estado==='pagada').length && <Empty>Sin pagos</Empty>}
                  {clientOrdenes.filter(o => o.estado==='pagada').map(o => (
                    <div key={o.id} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #F5F5F0', fontSize:'.78rem' }}>
                      <div><span style={{ fontWeight:700, color:G }}>{o.correlativo}</span>
                        {o.fechaPagoReal && <span style={{ color:'#888', marginLeft:8 }}>{fmtDate(o.fechaPagoReal)}</span>}
                      </div>
                      <span style={{ fontWeight:700, color:'#2D6645' }}>{fmtQ(o.total)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* CALENDARIO */}
              {tab==='calendario' && <CalendarioCliente events={calData} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function SectionHdr({ children, style }) {
  return <div style={{ fontWeight:700, fontSize:'.72rem', textTransform:'uppercase', color:'#888', letterSpacing:'.06em', margin:'2px 0 8px', ...style }}>{children}</div>;
}
function Empty({ children }) {
  return <div style={{ color:'#aaa', fontSize:'.83rem', textAlign:'center', padding:'12px 0' }}>{children}</div>;
}
function StatCard({ label, value, color }) {
  return (
    <div style={{ background:'#F5F5F0', borderRadius:6, padding:'10px 12px' }}>
      <div style={{ fontSize:'.65rem', fontWeight:700, textTransform:'uppercase', color:'#888', letterSpacing:'.06em', marginBottom:4 }}>{label}</div>
      <div style={{ fontWeight:800, fontSize:'1rem', color:color||'#1A3D28' }}>{value}</div>
    </div>
  );
}

const IS2 = { padding:'6px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.8rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };
const LS2 = { display:'flex', flexDirection:'column', gap:2, fontSize:'.7rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:8 };

function SucursalForm({ value, onChange, onSave, onCancel }) {
  const ev = (k, v) => onChange(f => ({ ...f, [k]: v }));
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 10px' }}>
        <label style={LS2}>Nombre <input value={value.nombre||''} onChange={e => ev('nombre', e.target.value)} style={IS2} /></label>
        <label style={LS2}>Contacto <input value={value.contacto||''} onChange={e => ev('contacto', e.target.value)} style={IS2} /></label>
        <label style={LS2}>Teléfono <input value={value.telefono||''} onChange={e => ev('telefono', e.target.value)} style={IS2} /></label>
        <label style={LS2}>Email <input value={value.email||''} onChange={e => ev('email', e.target.value)} style={IS2} /></label>
      </div>
      <label style={LS2}>Dirección <input value={value.direccion||''} onChange={e => ev('direccion', e.target.value)} style={IS2} /></label>
      <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.8rem', marginBottom:8, cursor:'pointer' }}>
        <input type="checkbox" checked={value.activa!==false} onChange={e => ev('activa', e.target.checked)} /> Activa
      </label>
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={onSave} style={{ padding:'5px 14px', background:'#1A3D28', color:'#fff', border:'none', borderRadius:3, fontWeight:700, fontSize:'.75rem', cursor:'pointer' }}>Guardar</button>
        <button onClick={onCancel} style={{ padding:'5px 14px', background:'transparent', color:'#555', border:'1px solid #E0E0E0', borderRadius:3, fontWeight:600, fontSize:'.75rem', cursor:'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
}

function CalendarioCliente({ events }) {
  const [mes, setMes] = useState(() => { const d=new Date(); return { year:d.getFullYear(), month:d.getMonth() }; });
  const diasEnMes = new Date(mes.year, mes.month+1, 0).getDate();
  const primerDia = new Date(mes.year, mes.month, 1).getDay();
  const todayStr  = new Date().toISOString().slice(0,10);
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const prevMes = () => setMes(m => m.month===0?{year:m.year-1,month:11}:{year:m.year,month:m.month-1});
  const nextMes = () => setMes(m => m.month===11?{year:m.year+1,month:0}:{year:m.year,month:m.month+1});
  const cells = [];
  for (let i=0; i<primerDia; i++) cells.push(null);
  for (let d=1; d<=diasEnMes; d++) {
    const ds = `${mes.year}-${String(mes.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({ d, ds, evs: events[ds]||[] });
  }
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <button onClick={prevMes} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem', color:'#888' }}>‹</button>
        <span style={{ fontWeight:700, fontSize:'.88rem', color:'#1A3D28' }}>{MESES[mes.month]} {mes.year}</span>
        <button onClick={nextMes} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem', color:'#888' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
        {['D','L','M','X','J','V','S'].map(d => <div key={d} style={{ textAlign:'center', fontSize:'.62rem', fontWeight:700, color:'#888' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} />;
          const isToday = cell.ds===todayStr;
          const hasEnt  = cell.evs.some(e => e.tipo==='entrega');
          const hasPago = cell.evs.some(e => e.tipo==='pago');
          const venc    = cell.evs.some(e => e.tipo==='pago' && cell.ds < todayStr);
          return (
            <div key={cell.ds} style={{ minHeight:32, padding:'2px 3px', borderRadius:4, background:isToday?'#E8F5E9':'#F9F9F6', border:isToday?`1.5px solid ${'#1A3D28'}`:'1px solid #EFEFEF' }}>
              <div style={{ fontSize:'.62rem', fontWeight:isToday?800:400, color:isToday?'#1A3D28':'#555', textAlign:'right' }}>{cell.d}</div>
              {hasEnt  && <div style={{ fontSize:'.5rem', background:'#BBDEFB', borderRadius:2, padding:'1px 2px', color:'#0D47A1', fontWeight:700 }}>ENT</div>}
              {hasPago && <div style={{ fontSize:'.5rem', background:venc?'#FFCDD2':'#FFE0B2', borderRadius:2, padding:'1px 2px', color:venc?'#C62828':'#E65100', fontWeight:700 }}>PAG</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:10, marginTop:8, fontSize:'.68rem', flexWrap:'wrap' }}>
        <span><span style={{ background:'#BBDEFB', padding:'1px 4px', borderRadius:2, color:'#0D47A1', fontWeight:700 }}>ENT</span> Entrega</span>
        <span><span style={{ background:'#FFE0B2', padding:'1px 4px', borderRadius:2, color:'#E65100', fontWeight:700 }}>PAG</span> Pago pendiente</span>
        <span><span style={{ background:'#FFCDD2', padding:'1px 4px', borderRadius:2, color:'#C62828', fontWeight:700 }}>PAG</span> Vencido</span>
      </div>
    </div>
  );
}
