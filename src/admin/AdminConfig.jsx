import { useState, useEffect } from 'react';
import { db, doc, getDoc, setDoc, serverTimestamp } from '../firebase.js';
import { useToast } from '../components/Toast.jsx';

const G = '#1A3D28';
const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:12 };
const IS = { padding:'9px 12px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

export default function AdminConfig() {
  const toast = useToast();
  const [config, setConfig] = useState({
    // Store settings
    nombreTienda:       'AJÚA Tienda',
    descripcion:        'Vegetales frescos, directo al negocio',
    emailContacto:      'agroajua@gmail.com',
    telefonoContacto:   '',
    whatsapp:           '',
    // Min purchases per tier (Q)
    minCompra_publico:   500,
    minCompra_general:   0,
    minCompra_negociado: 0,
    // Facturacion
    facturacion_serie:   'A',
    facturacion_emisor:  'AGROINDUSTRIA AJUA S.A.',
    facturacion_nit:     '',
    // API keys
    apiKeys: [],
    // Payment info
    banco:              '',
    cuentaBancaria:     '',
    nombreCuenta:       '',
  });
  const [saving, setSaving] = useState(false);
  const [newApiKey, setNewApiKey] = useState({ nombre: '', sistemaExterno: '' });

  useEffect(() => {
    getDoc(doc(db, 't_config', 'tienda')).then(s => {
      if (s.exists()) setConfig(c => ({ ...c, ...s.data() }));
    });
  }, []);

  const s = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 't_config', 'tienda'), { ...config, actualizadoEn: serverTimestamp() }, { merge: true });
      toast('✓ Configuración guardada');
    } catch { toast('Error al guardar', 'error'); }
    finally { setSaving(false); }
  };

  const generateApiKey = () => {
    if (!newApiKey.nombre) { toast('Ingresá el nombre del cliente API', 'warn'); return; }
    const key = 'ajua_' + Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2,'0')).join('');
    const apiKeys = [...(config.apiKeys || []), { ...newApiKey, key, activo: true, creadoEn: new Date().toISOString() }];
    s('apiKeys', apiKeys);
    setNewApiKey({ nombre: '', sistemaExterno: '' });
    toast('✓ API Key generada — guardá la config para que sea permanente');
  };

  const revokeApiKey = key => {
    const apiKeys = (config.apiKeys || []).map(k => k.key === key ? { ...k, activo: false } : k);
    s('apiKeys', apiKeys);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: G, marginBottom: 20 }}>Configuración</h1>

      <Section title="Información de la tienda">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <label style={LS}>Nombre de la tienda<input value={config.nombreTienda} onChange={e => s('nombreTienda', e.target.value)} style={IS} /></label>
          <label style={LS}>Email de contacto<input type="email" value={config.emailContacto} onChange={e => s('emailContacto', e.target.value)} style={IS} /></label>
          <label style={LS}>Teléfono<input value={config.telefonoContacto} onChange={e => s('telefonoContacto', e.target.value)} style={IS} /></label>
          <label style={LS}>WhatsApp (con código país)<input value={config.whatsapp} onChange={e => s('whatsapp', e.target.value)} placeholder="+50212345678" style={IS} /></label>
          <label style={{ ...LS, gridColumn: 'span 2' }}>Descripción<input value={config.descripcion} onChange={e => s('descripcion', e.target.value)} style={IS} /></label>
        </div>
      </Section>

      <Section title="Mínimos de compra (Q)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <label style={LS}>Público (sin login)<input type="number" min="0" value={config.minCompra_publico} onChange={e => s('minCompra_publico', parseFloat(e.target.value) || 0)} style={IS} /></label>
          <label style={LS}>General (registrado)<input type="number" min="0" value={config.minCompra_general} onChange={e => s('minCompra_general', parseFloat(e.target.value) || 0)} style={IS} /></label>
          <label style={LS}>Negociado<input type="number" min="0" value={config.minCompra_negociado} onChange={e => s('minCompra_negociado', parseFloat(e.target.value) || 0)} style={IS} /></label>
        </div>
      </Section>

      <Section title="Facturación FEL">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <label style={LS}>Emisor / Razón social<input value={config.facturacion_emisor} onChange={e => s('facturacion_emisor', e.target.value)} style={IS} /></label>
          <label style={LS}>NIT del emisor<input value={config.facturacion_nit} onChange={e => s('facturacion_nit', e.target.value)} style={IS} /></label>
          <label style={LS}>Serie FEL (letra o código)<input value={config.facturacion_serie} onChange={e => s('facturacion_serie', e.target.value)} placeholder="A" style={IS} /></label>
        </div>
        <div style={{ marginTop: 10, padding: '10px 14px', background: '#E8F5E9', borderRadius: 4, fontSize: '.8rem', color: G }}>
          📌 Estructura lista para conectar con certificador (Infile, G4S, Megaprint). Por ahora: ingresá UUID manualmente o subí el XML desde Facturación.
        </div>
      </Section>

      <Section title="Datos bancarios (para cobros)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <label style={LS}>Banco<input value={config.banco} onChange={e => s('banco', e.target.value)} placeholder="Banco Industrial, BAC..." style={IS} /></label>
          <label style={LS}>No. de cuenta<input value={config.cuentaBancaria} onChange={e => s('cuentaBancaria', e.target.value)} style={IS} /></label>
          <label style={LS}>Nombre en cuenta<input value={config.nombreCuenta} onChange={e => s('nombreCuenta', e.target.value)} style={IS} /></label>
        </div>
      </Section>

      <Section title="API Keys — Integración externa (SAP, restaurantes, etc.)">
        <div style={{ marginBottom: 14, padding: '12px 14px', background: '#E3F2FD', borderRadius: 4, fontSize: '.8rem', color: '#1565C0' }}>
          🔗 Generá API Keys para que sistemas externos (SAP, sistemas de restaurantes) puedan enviar OC y consultar el catálogo via la API REST.
          Endpoint: <code style={{ background: 'rgba(0,0,0,.06)', padding: '1px 6px', borderRadius: 3 }}>POST /api/v1/ordenes</code>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0 10px', marginBottom: 14, alignItems: 'end' }}>
          <label style={LS}>Nombre del sistema<input value={newApiKey.nombre} onChange={e => setNewApiKey(k => ({ ...k, nombre: e.target.value }))} placeholder="Ej. SAP, Sistema XYZ" style={IS} /></label>
          <label style={LS}>Sistema externo<input value={newApiKey.sistemaExterno} onChange={e => setNewApiKey(k => ({ ...k, sistemaExterno: e.target.value }))} placeholder="SAP, Invu POS, etc." style={IS} /></label>
          <button onClick={generateApiKey} style={{ padding: '9px 14px', background: G, color: '#fff', border: 'none', borderRadius: 4, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: 12 }}>
            + Generar Key
          </button>
        </div>

        {(config.apiKeys || []).length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
            <thead>
              <tr style={{ background: '#F5F5F0' }}>
                {['Sistema', 'API Key', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(config.apiKeys || []).map((k, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F0F0EC' }}>
                  <td style={{ padding: '8px 10px', fontSize: '.83rem', fontWeight: 600 }}>{k.nombre} · <span style={{ fontWeight: 400, color: '#888' }}>{k.sistemaExterno}</span></td>
                  <td style={{ padding: '8px 10px' }}>
                    <code style={{ fontSize: '.75rem', background: '#F0F0EC', padding: '3px 8px', borderRadius: 4, wordBreak: 'break-all' }}>
                      {k.activo ? k.key : '••••••••••••••••'}
                    </code>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: '.7rem', fontWeight: 700, color: k.activo ? '#1B5E20' : '#C62828' }}>{k.activo ? '✓ Activa' : '✗ Revocada'}</span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {k.activo && <button onClick={() => revokeApiKey(k.key)} style={{ padding: '3px 10px', background: '#FFEBEE', color: '#C62828', border: 'none', borderRadius: 4, fontSize: '.7rem', cursor: 'pointer', fontWeight: 600 }}>Revocar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <button onClick={handleSave} disabled={saving} style={{ padding: '12px 32px', background: saving ? '#ccc' : G, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Guardando…' : '✓ Guardar configuración'}
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E0E0E0', borderRadius: 8, padding: 20, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.07em', color: G, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #F0F0EC' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
