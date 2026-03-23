/**
 * MiPerfil — datos, dirección principal y sucursales del cliente.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, doc, updateDoc } from '../../firebase.js';
import { useToast } from '../../components/Toast.jsx';
import AddressForm from '../../components/AddressForm.jsx';
import { TIPOS_NEGOCIO } from '../../utils/catalogos.js';

const G  = '#1A3D28';
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:12 };
const IS = { padding:'10px 12px', border:'1.5px solid #E8DCC8', borderRadius:4, fontSize:'.88rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

const BLANK_SUC = { id:'', nombre:'', contacto:'', telefono:'', direccion:{ pais:'Guatemala', departamento:'', municipio:'', zona:'', direccion:'', referencias:'' } };

export default function MiPerfil() {
  const { cliente, user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    nombre:      '',
    empresa:     '',
    tipo:        'individual',
    tipoNegocio: '',
    telefono:    '',
    nit:         '',
    direccion:   { pais:'Guatemala', departamento:'', municipio:'', zona:'', direccion:'', referencias:'' },
  });
  const [saving, setSaving] = useState(false);

  // Sucursales
  const [sucursales, setSucursales] = useState([]);
  const [editSuc, setEditSuc]       = useState(null);   // null | BLANK_SUC | existing
  const [savingSuc, setSavingSuc]   = useState(false);

  useEffect(() => {
    if (!cliente) return;
    setForm({
      nombre:      cliente.nombre      || '',
      empresa:     cliente.empresa     || '',
      tipo:        cliente.tipo        || 'individual',
      tipoNegocio: cliente.tipoNegocio || '',
      telefono:    cliente.telefono    || '',
      nit:         cliente.nit         || '',
      direccion:   cliente.direccion   || { pais:'Guatemala', departamento:'', municipio:'', zona:'', direccion:'', referencias:'' },
    });
    setSucursales(cliente.sucursales || []);
  }, [cliente]);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre) { toast('Nombre es requerido', 'warn'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 't_clientes', user.uid), {
        nombre:      form.nombre,
        empresa:     form.empresa,
        tipo:        form.tipo,
        tipoNegocio: form.tipo === 'negocio' ? form.tipoNegocio : '',
        telefono:    form.telefono,
        nit:         form.nit,
        direccion:   form.direccion,
      });
      toast('✓ Perfil actualizado');
    } catch { toast('Error al guardar', 'error'); }
    finally { setSaving(false); }
  };

  // ── Sucursales ────────────────────────────────────────────────────────────
  const startNewSuc = () => setEditSuc({ ...BLANK_SUC, id: `suc_${Date.now()}` });
  const cancelSuc   = () => setEditSuc(null);

  const ss = (k, v) => setEditSuc(e => ({ ...e, [k]: v }));

  const saveSuc = async () => {
    if (!editSuc.nombre) { toast('Nombre de sucursal requerido', 'warn'); return; }
    setSavingSuc(true);
    try {
      const updated = sucursales.some(s => s.id === editSuc.id)
        ? sucursales.map(s => s.id === editSuc.id ? editSuc : s)
        : [...sucursales, editSuc];
      await updateDoc(doc(db, 't_clientes', user.uid), { sucursales: updated });
      setSucursales(updated);
      setEditSuc(null);
      toast('✓ Sucursal guardada');
    } catch { toast('Error al guardar sucursal', 'error'); }
    finally { setSavingSuc(false); }
  };

  const deleteSuc = async (id) => {
    if (!window.confirm('¿Eliminar esta sucursal?')) return;
    const updated = sucursales.filter(s => s.id !== id);
    await updateDoc(doc(db, 't_clientes', user.uid), { sucursales: updated });
    setSucursales(updated);
    toast('Sucursal eliminada');
  };

  const esNegocio = form.tipo === 'negocio';

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: G, marginBottom: 20 }}>Mi perfil</h2>

      {/* ── Tipo de cuenta ── */}
      <Section title="Tipo de cuenta">
        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          {[['individual','👤 Individual'],['negocio','🏢 Negocio']].map(([val, label]) => (
            <button key={val} type="button" onClick={() => sf('tipo', val)}
              style={{ flex:1, padding:'9px 8px', border:`2px solid ${form.tipo === val ? G : '#E8DCC8'}`, borderRadius:6, background: form.tipo === val ? '#F0F7F2' : '#fff', color: form.tipo === val ? G : '#888', fontWeight: form.tipo === val ? 700 : 500, fontSize:'.82rem', cursor:'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {esNegocio && (
          <label style={LS}>
            Tipo de negocio
            <select value={form.tipoNegocio} onChange={e => sf('tipoNegocio', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {TIPOS_NEGOCIO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
      </Section>

      {/* ── Datos básicos ── */}
      <Section title="Datos básicos">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
          <label style={{ ...LS, gridColumn:'span 2' }}>
            Nombre / Contacto *
            <input value={form.nombre} onChange={e => sf('nombre', e.target.value)} style={IS} />
          </label>
          {esNegocio && (
            <label style={{ ...LS, gridColumn:'span 2' }}>
              Nombre del negocio
              <input value={form.empresa} onChange={e => sf('empresa', e.target.value)} style={IS} />
            </label>
          )}
          <label style={LS}>
            Teléfono / WhatsApp
            <input value={form.telefono} onChange={e => sf('telefono', e.target.value)} placeholder="+502 ..." style={IS} />
          </label>
          <label style={LS}>
            NIT
            <input value={form.nit} onChange={e => sf('nit', e.target.value)} placeholder="CF" style={IS} />
          </label>
        </div>
      </Section>

      {/* ── Dirección principal ── */}
      <Section title="Dirección de entrega principal">
        <div style={{ fontSize:'.78rem', color:'#6B8070', marginBottom:12 }}>
          Esta dirección se usará por defecto en tus pedidos.
        </div>
        <AddressForm value={form.direccion} onChange={v => sf('direccion', v)} />
      </Section>

      <button onClick={handleSave} disabled={saving}
        style={{ padding:'11px 28px', background: saving ? '#ccc' : G, color:'#F5F0E4', border:'none', borderRadius:4, fontWeight:700, fontSize:'.88rem', cursor: saving ? 'not-allowed' : 'pointer', marginBottom:28 }}>
        {saving ? 'Guardando…' : '✓ Guardar perfil'}
      </button>

      {/* ── Sucursales (only for businesses) ── */}
      {esNegocio && (
        <Section title={`Sucursales (${sucursales.length})`}>
          <div style={{ fontSize:'.78rem', color:'#6B8070', marginBottom:12 }}>
            Registrá cada punto de entrega de tu negocio. Al hacer un pedido podrás elegir a qué sucursal enviarlo.
          </div>

          {sucursales.map(suc => (
            <div key={suc.id} style={{ background:'#F9F9F6', borderRadius:6, padding:'12px 14px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
              <div>
                <div style={{ fontWeight:700, color:G, fontSize:'.88rem' }}>{suc.nombre}</div>
                {suc.contacto && <div style={{ fontSize:'.78rem', color:'#555', marginTop:2 }}>Contacto: {suc.contacto}</div>}
                {suc.telefono && <div style={{ fontSize:'.78rem', color:'#555' }}>Tel: {suc.telefono}</div>}
                {suc.direccion?.direccion && (
                  <div style={{ fontSize:'.75rem', color:'#888', marginTop:4 }}>
                    {[suc.direccion.direccion, suc.direccion.zona, suc.direccion.municipio, suc.direccion.departamento].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button onClick={() => setEditSuc(suc)} style={{ padding:'4px 10px', background:'#E3F2FD', color:'#1565C0', border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                <button onClick={() => deleteSuc(suc.id)} style={{ padding:'4px 10px', background:'#FFEBEE', color:'#C62828', border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>✕</button>
              </div>
            </div>
          ))}

          {editSuc ? (
            <div style={{ border:'1.5px solid #D0E8D0', borderRadius:8, padding:16, marginTop:12 }}>
              <div style={{ fontWeight:700, color:G, fontSize:'.83rem', marginBottom:12 }}>
                {sucursales.some(s => s.id === editSuc.id) ? 'Editar sucursal' : 'Nueva sucursal'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
                <label style={{ ...LS, gridColumn:'span 2' }}>
                  Nombre de la sucursal *
                  <input value={editSuc.nombre} onChange={e => ss('nombre', e.target.value)} placeholder="Sucursal Centro, Zona 10..." style={IS} />
                </label>
                <label style={LS}>
                  Persona de contacto
                  <input value={editSuc.contacto} onChange={e => ss('contacto', e.target.value)} placeholder="Nombre del encargado" style={IS} />
                </label>
                <label style={LS}>
                  Teléfono
                  <input value={editSuc.telefono} onChange={e => ss('telefono', e.target.value)} placeholder="+502 ..." style={IS} />
                </label>
              </div>
              <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', margin:'12px 0 8px' }}>Dirección de la sucursal</div>
              <AddressForm value={editSuc.direccion} onChange={v => ss('direccion', v)} />
              <div style={{ display:'flex', gap:8, marginTop:14 }}>
                <button onClick={saveSuc} disabled={savingSuc}
                  style={{ padding:'9px 20px', background: savingSuc ? '#ccc' : G, color:'#fff', border:'none', borderRadius:4, fontWeight:700, fontSize:'.83rem', cursor: savingSuc ? 'not-allowed' : 'pointer' }}>
                  {savingSuc ? 'Guardando…' : 'Guardar sucursal'}
                </button>
                <button onClick={cancelSuc} style={{ padding:'9px 14px', background:'#F5F5F5', border:'1px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', cursor:'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={startNewSuc}
              style={{ width:'100%', padding:'9px', border:'1.5px dashed #B0CCB8', borderRadius:6, background:'transparent', color:G, fontWeight:700, fontSize:'.83rem', cursor:'pointer', marginTop:4 }}>
              + Agregar sucursal
            </button>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background:'#FDFCF8', border:'1px solid #E8DCC8', borderRadius:8, padding:18, marginBottom:16 }}>
      <div style={{ fontWeight:700, fontSize:'.75rem', textTransform:'uppercase', letterSpacing:'.07em', color:G, marginBottom:14, paddingBottom:10, borderBottom:'1px solid #F0EBE0' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
