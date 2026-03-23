import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

const G = '#1A3D28';
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:12 };
const IS = { padding:'10px 12px', border:'1.5px solid #E8DCC8', borderRadius:4, fontSize:'.88rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

export default function Registro() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', empresa: '', email: '', telefono: '', pass: '', pass2: '' });
  const [loading, setLoading] = useState(false);
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.nombre || !form.email || !form.pass) { toast('Completá los campos requeridos', 'warn'); return; }
    if (form.pass !== form.pass2) { toast('Las contraseñas no coinciden', 'error'); return; }
    if (form.pass.length < 6) { toast('Contraseña mínimo 6 caracteres', 'warn'); return; }
    setLoading(true);
    try {
      await register(form.email, form.pass, form.nombre, form.telefono);
      toast('✓ Cuenta creada. ¡Bienvenido a AJÚA Tienda!');
      navigate('/');
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Ese email ya está registrado' : 'Error al crear cuenta. Intenta de nuevo.';
      toast(msg, 'error');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>🌿</div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: G }}>Crear cuenta cliente</h1>
          <p style={{ fontSize: '.82rem', color: '#6B8070', marginTop: 4 }}>Accedé a precios generales y gestioná tus pedidos</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 10, padding: 28, boxShadow: '0 4px 20px rgba(26,61,40,.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <label style={{ ...LS, gridColumn: 'span 2' }}>
              Nombre completo *
              <input value={form.nombre} onChange={e => s('nombre', e.target.value)} placeholder="Tu nombre" style={IS} autoFocus />
            </label>
            <label style={LS}>
              Empresa / Negocio
              <input value={form.empresa} onChange={e => s('empresa', e.target.value)} placeholder="Opcional" style={IS} />
            </label>
            <label style={LS}>
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
