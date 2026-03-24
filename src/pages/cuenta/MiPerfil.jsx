import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { auth } from '../../firebase.js';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const G  = '#1B5E20';
const IS = { padding:'9px 12px',border:'1.5px solid #E0E0E0',borderRadius:6,fontSize:'.85rem',outline:'none',fontFamily:'inherit',width:'100%',marginTop:4 };
const LS = { display:'flex',flexDirection:'column',gap:2,fontSize:'.72rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'#888',marginBottom:10 };

const Row = ({ l, v }) => (
  <div style={{padding:'8px 0',borderBottom:'1px solid #F5F3EF',display:'flex',justifyContent:'space-between',fontSize:'.84rem'}}>
    <span style={{color:'#aaa',fontWeight:600}}>{l}</span>
    <span style={{color:'#222',maxWidth:'60%',textAlign:'right'}}>{v||'—'}</span>
  </div>
);

export default function MiPerfil() {
  const { cliente, logout } = useAuth();
  const toast = useToast();
  const [passForm, setPassForm] = useState({ actual:'', nueva:'', confirmar:'' });
  const [saving, setSaving] = useState(false);
  const pf = (k,v) => setPassForm(f=>({...f,[k]:v}));

  const handlePassword = async e => {
    e.preventDefault();
    if (passForm.nueva !== passForm.confirmar) { toast('Las contraseñas no coinciden','error'); return; }
    if (passForm.nueva.length < 6) { toast('Mínimo 6 caracteres','error'); return; }
    setSaving(true);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, passForm.actual);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, passForm.nueva);
      toast('✓ Contraseña actualizada');
      setPassForm({ actual:'', nueva:'', confirmar:'' });
    } catch (err) {
      const msg = err.code==='auth/wrong-password'?'Contraseña actual incorrecta':'Error al cambiar contraseña';
      toast(msg,'error');
    } finally { setSaving(false); }
  };

  const sucursales = (cliente?.sucursales||[]).filter(s=>s.activa!==false);

  return (
    <div style={{padding:'24px 28px 80px',maxWidth:680}}>
      <div style={{fontSize:'1.2rem',fontWeight:900,color:G,marginBottom:24}}>Mi Perfil</div>

      {/* Datos empresa */}
      <Section title="Datos de la empresa">
        <Row l="Nombre"    v={cliente?.nombre} />
        <Row l="Empresa"   v={cliente?.empresa} />
        <Row l="Código"    v={cliente?.codigo} />
        <Row l="NIT"       v={cliente?.nit} />
        <Row l="Teléfono"  v={cliente?.telefono} />
        <Row l="Email"     v={cliente?.email} />
        <Row l="Tipo"      v={cliente?.tier} />
        {cliente?.diasCredito>0
          ? <Row l="Crédito" v={`${cliente.diasCredito} días`} />
          : <Row l="Condición pago" v="Contado" />}
      </Section>

      {/* Sucursales */}
      {sucursales.length>0&&(
        <Section title={`Mis sucursales (${sucursales.length})`}>
          {sucursales.map((s,i)=>(
            <div key={s.id||i} style={{padding:'10px 0',borderBottom:'1px solid #F5F3EF'}}>
              <div style={{fontWeight:600,fontSize:'.85rem',color:'#222'}}>{s.nombre}</div>
              {s.direccion?.direccion&&<div style={{fontSize:'.75rem',color:'#aaa',marginTop:2}}>{s.direccion.direccion}{s.direccion.zona?`, zona ${s.direccion.zona}`:''}</div>}
              {s.telefono&&<div style={{fontSize:'.75rem',color:'#aaa'}}>{s.telefono}</div>}
            </div>
          ))}
        </Section>
      )}

      {/* Lista de precios */}
      <Section title="Lista de precios">
        <Row l="Lista asignada" v={cliente?.listaId==='general'?'Lista General':cliente?.listaId} />
        <div style={{marginTop:12,fontSize:'.78rem',color:'#aaa'}}>
          Para cambios en tu lista de precios contactá a{' '}
          <a href="mailto:agroajua@gmail.com" style={{color:G,fontWeight:600}}>agroajua@gmail.com</a>
        </div>
      </Section>

      {/* Cambiar contraseña */}
      <Section title="Cambiar contraseña">
        <form onSubmit={handlePassword}>
          <label style={LS}>Contraseña actual<input type="password" value={passForm.actual} onChange={e=>pf('actual',e.target.value)} style={IS} /></label>
          <label style={LS}>Nueva contraseña<input type="password" value={passForm.nueva} onChange={e=>pf('nueva',e.target.value)} style={IS} /></label>
          <label style={LS}>Confirmar<input type="password" value={passForm.confirmar} onChange={e=>pf('confirmar',e.target.value)} style={IS} /></label>
          <button type="submit" disabled={saving}
            style={{padding:'10px 24px',background:saving?'#ccc':G,color:'#fff',border:'none',borderRadius:8,fontWeight:700,fontSize:'.85rem',cursor:saving?'not-allowed':'pointer',marginTop:4}}>
            {saving?'Guardando…':'Guardar contraseña'}
          </button>
        </form>
      </Section>

      <button onClick={logout}
        style={{marginTop:8,padding:'10px 24px',background:'transparent',border:'1.5px solid #E0E0E0',color:'#888',borderRadius:8,fontWeight:600,fontSize:'.85rem',cursor:'pointer'}}>
        Cerrar sesión
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{background:'#fff',borderRadius:12,padding:'16px 20px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',marginBottom:16}}>
      <div style={{fontWeight:700,color:G,fontSize:'.85rem',marginBottom:12}}>{title}</div>
      {children}
    </div>
  );
}
