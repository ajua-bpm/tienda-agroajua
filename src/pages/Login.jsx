import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

const G = '#1A3D28', ACC = '#4A9E6A';
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:12 };
const IS = { padding:'10px 12px', border:'1.5px solid #E8DCC8', borderRadius:4, fontSize:'.88rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2, transition:'border-color .15s' };

export default function Login() {
  const { login, resetPassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleLogin = async e => {
    e.preventDefault();
    if (!email || !pass) { toast('Ingresá email y contraseña', 'warn'); return; }
    setLoading(true);
    try {
      await login(email, pass);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' ? 'Email o contraseña incorrectos' : 'Error al ingresar. Intenta de nuevo.';
      toast(msg, 'error');
    } finally { setLoading(false); }
  };

  const handleReset = async e => {
    e.preventDefault();
    if (!email) { toast('Ingresá tu email primero', 'warn'); return; }
    try {
      await resetPassword(email);
      toast('✓ Correo de recuperación enviado');
      setShowReset(false);
    } catch { toast('Error al enviar correo', 'error'); }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>🌿</div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: G }}>Acceso AJÚA Tienda</h1>
          <p style={{ fontSize: '.82rem', color: '#6B8070', marginTop: 4 }}>Ingresá para ver tus precios y gestionar pedidos</p>
        </div>

        <form onSubmit={showReset ? handleReset : handleLogin} style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 10, padding: 28, boxShadow: '0 4px 20px rgba(26,61,40,.08)' }}>
          <label style={LS}>
            Email *
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@empresa.com" style={IS} autoFocus />
          </label>
          {!showReset && (
            <label style={LS}>
              Contraseña *
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" style={IS} />
            </label>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: loading ? '#ccc' : G, color: '#F5F0E4', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '.88rem', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 12 }}>
            {loading ? 'Ingresando...' : showReset ? 'Enviar recuperación' : 'Ingresar →'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '.76rem', color: '#6B8070' }}>
            <button type="button" onClick={() => setShowReset(v => !v)} style={{ background: 'none', border: 'none', color: ACC, cursor: 'pointer', fontSize: '.76rem', fontFamily: 'inherit' }}>
              {showReset ? '← Volver al login' : '¿Olvidaste tu contraseña?'}
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: '.8rem', color: '#6B8070' }}>
          ¿No tenés cuenta?{' '}
          <Link to="/registro" style={{ color: G, fontWeight: 700, textDecoration: 'none' }}>Registrate →</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: '.75rem', color: '#aaa' }}>
          Para precios negociados contactá a{' '}
          <a href="mailto:agroajua@gmail.com" style={{ color: ACC }}>agroajua@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
