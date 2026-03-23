import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { TIPOS_NEGOCIO } from '../utils/catalogos.js';

const G = '#1A3D28';
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:12 };
const IS = { padding:'10px 12px', border:'1.5px solid #E8DCC8', borderRadius:4, fontSize:'.88rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

export default function Registro() {
  const { register } = useAuth();
  const toast  = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    tipo:         'individual',   // 'individual' | 'negocio'
    tipoNegocio:  '',
    nombre:       '',
    empresa:      '',
    telefono:     '',
    email:        '',
    pass:         '',
    pass2:        '',
  });
  const [loading, setLoading] = useState(false);
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const esNegocio = form.tipo === 'negocio';

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.nombre || !form.email || !form.pass) { toast('Completá los campos requeridos', 'warn'); return; }
    if (esNegocio && !form.empresa) { toast('Ingresá el nombre de tu negocio', 'warn'); return; }
    if (form.pass !== form.pass2) { toast('Las contraseñas no coinciden', 'error'); return; }
    if (form.pass.length < 6) { toast('Contraseña mínimo 6 caracteres', 'warn'); return; }
    setLoading(true);
    try {
      await register(form.email, form.pass, form.nombre, form.telefono, {
        tipo:        form.tipo,
        tipoNegocio: esNegocio ? form.tipoNegocio : '',
        empresa:     form.empresa,
      });
      toast('✓ Cuenta creada. ¡Bienvenido a AJÚA Tienda!');
      navigate('/');
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Ese email ya está registrado' : 'Error al crear cuenta. Intenta de nuevo.';
      toast(msg, 'error');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>🌿</div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: G }}>Crear cuenta cliente</h1>
          <p style={{ fontSize: '.82rem', color: '#6B8070', marginTop: 4 }}>Accedé a precios generales y gestioná tus pedidos</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 10, padding: 28, boxShadow: '0 4px 20px rgba(26,61,40,.08)' }}>

          {/* Tipo de cuenta */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#555', marginBottom: 8 }}>Tipo de cuenta</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['individual', '👤 Individual / Persona'], ['negocio', '🏢 Negocio / Empresa']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => s('tipo', val)}
                  style={{ flex: 1, padding: '10px 8px', border: `2px solid ${form.tipo === val ? G : '#E8DCC8'}`, borderRadius: 6, background: form.tipo === val ? '#F0F7F2' : '#fff', color: form.tipo === val ? G : '#888', fontWeight: form.tipo === val ? 700 : 500, fontSize: '.82rem', cursor: 'pointer', transition: 'all .15s' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <label style={{ ...LS, gridColumn: 'span 2' }}>
              Nombre completo / Contacto *
              <input value={form.nombre} onChange={e => s('nombre', e.target.value)} placeholder="Tu nombre" style={IS} autoFocus />
            </label>

            {esNegocio && <>
              <label style={{ ...LS, gridColumn: 'span 2' }}>
                Nombre del negocio *
                <input value={form.empresa} onChange={e => s('empresa', e.target.value)} placeholder="Restaurante Don Pepito" style={IS} />
              </label>
              <label style={{ ...LS, gridColumn: 'span 2' }}>
                Tipo de negocio
                <select value={form.tipoNegocio} onChange={e => s('tipoNegocio', e.target.value)} style={IS}>
                  <option value="">— Seleccionar —</option>
                  {TIPOS_NEGOCIO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </>}

            {!esNegocio && (
              <label style={LS}>
                Empresa (opcional)
                <input value={form.empresa} onChange={e => s('empresa', e.target.value)} placeholder="Donde trabajás" style={IS} />
              </label>
            )}

            <label style={esNegocio ? LS : { ...LS }}>
              Teléfono / WhatsApp
              <input value={form.telefono} onChange={e => s('telefono', e.target.value)} placeholder="+502 ..." style={IS} />
            </label>

            <label style={{ ...LS, gridColumn: 'span 2' }}>
              Email *
              <input type="email" value={form.email} onChange={e => s('email', e.target.value)} placeholder="correo@empresa.com" style={IS} />
            </label>
            <label style={LS}>
              Contraseña *
              <input type="password" value={form.pass} onChange={e => s('pass', e.target.value)} placeholder="Mín. 6 caracteres" style={IS} />
            </label>
            <label style={LS}>
              Confirmar contraseña *
              <input type="password" value={form.pass2} onChange={e => s('pass2', e.target.value)} placeholder="Repetir contraseña" style={IS} />
            </label>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: loading ? '#ccc' : G, color: '#F5F0E4', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '.88rem', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta →'}
          </button>

          <p style={{ fontSize: '.72rem', color: '#aaa', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
            Para precios negociados, contactá a{' '}
            <a href="mailto:agroajua@gmail.com" style={{ color: '#4A9E6A' }}>agroajua@gmail.com</a>{' '}
            después de registrarte.
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: '.8rem', color: '#6B8070' }}>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" style={{ color: G, fontWeight: 700, textDecoration: 'none' }}>Ingresar →</Link>
        </p>
      </div>
    </div>
  );
}
