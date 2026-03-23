import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, doc, updateDoc } from '../../firebase.js';
import { useToast } from '../../components/Toast.jsx';
import { TIER_LABEL, TIER_COLOR } from '../../utils/format.js';

const G = '#1A3D28';
const navLinkStyle = active => ({
  display: 'block', padding: '9px 14px', borderRadius: 6,
  fontWeight: 600, fontSize: '.83rem', textDecoration: 'none',
  background: active ? G : 'transparent',
  color: active ? '#F5F0E4' : '#555',
  transition: 'all .15s',
});

export default function MiCuenta() {
  const { cliente, user } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nombre: cliente?.nombre || '', telefono: cliente?.telefono || '', empresa: cliente?.empresa || '', nit: cliente?.nit || '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 't_clientes', user.uid), form);
      toast('✓ Perfil actualizado');
      setEditing(false);
    } catch { toast('Error al guardar', 'error'); }
    finally { setSaving(false); }
  };

  const tier = cliente?.tier || 'general';
  const { bg, color } = TIER_COLOR[tier] || {};

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
      {/* Sidebar */}
      <div>
        <div style={{ background: '#FDFCF8', border: '1px solid #E8DCC8', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: G, marginBottom: 2 }}>{cliente?.nombre || 'Cliente'}</div>
          <div style={{ fontSize: '.75rem', color: '#6B8070', marginBottom: 8 }}>{user?.email}</div>
          <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: bg, color }}>{TIER_LABEL[tier]}</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/cuenta/ordenes" style={({ isActive }) => navLinkStyle(isActive)}>📋 Mis pedidos</NavLink>
          <NavLink to="/cuenta" end style={({ isActive }) => navLinkStyle(isActive)}>👤 Mi perfil</NavLink>
        </nav>
      </div>

      {/* Main */}
      <div>
        <Outlet context={{ editing, setEditing, form, setForm, handleSave, saving }} />
        {/* Default content when on /cuenta exactly — profile */}
      </div>
    </div>
  );
}
