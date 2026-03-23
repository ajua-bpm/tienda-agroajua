/**
 * AddressForm — País → Departamento → Municipio → Zona → Dirección → Referencias
 * Props:
 *   value: { pais, departamento, municipio, zona, direccion, referencias }
 *   onChange: fn(newValue)
 *   required: bool
 */
import { PAISES, DEPARTAMENTOS_GT, MUNICIPIOS_GT, ZONAS_GUATEMALA } from '../utils/catalogos.js';

const LS = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#555', marginBottom:10 };
const IS = { padding:'8px 10px', border:'1.5px solid #E0E0E0', borderRadius:4, fontSize:'.83rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2 };

export default function AddressForm({ value = {}, onChange, required }) {
  const upd = (k, v) => onChange({ ...value, [k]: v });

  const pais        = value.pais        || '';
  const departamento = value.departamento || '';
  const municipio   = value.municipio   || '';
  const zona        = value.zona        || '';
  const direccion   = value.direccion   || '';
  const referencias = value.referencias || '';

  const esGuatemala    = pais === 'Guatemala';
  const esGuateCiudad  = esGuatemala && departamento === 'Guatemala';
  const municipios     = esGuatemala ? (MUNICIPIOS_GT[departamento] || []) : [];

  return (
    <div>
      {/* País */}
      <label style={LS}>
        País {required && <span style={{ color:'#C62828' }}>*</span>}
        <select value={pais} onChange={e => onChange({ ...value, pais: e.target.value, departamento:'', municipio:'', zona:'' })} style={IS}>
          <option value="">— Seleccionar —</option>
          {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>

      {/* Departamento — solo Guatemala */}
      {esGuatemala && (
        <label style={LS}>
          Departamento {required && <span style={{ color:'#C62828' }}>*</span>}
          <select value={departamento} onChange={e => onChange({ ...value, departamento: e.target.value, municipio:'', zona:'' })} style={IS}>
            <option value="">— Seleccionar —</option>
            {DEPARTAMENTOS_GT.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      )}

      {/* Municipio */}
      {esGuatemala && departamento && (
        <label style={LS}>
          Municipio {required && <span style={{ color:'#C62828' }}>*</span>}
          <select value={municipio} onChange={e => onChange({ ...value, municipio: e.target.value, zona:'' })} style={IS}>
            <option value="">— Seleccionar —</option>
            {municipios.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      )}

      {/* Zona — solo Guatemala Ciudad */}
      {esGuateCiudad && municipio === 'Guatemala (Ciudad)' && (
        <label style={LS}>
          Zona
          <select value={zona} onChange={e => upd('zona', e.target.value)} style={IS}>
            <option value="">— Seleccionar —</option>
            {ZONAS_GUATEMALA.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
      )}

      {/* Dirección */}
      <label style={LS}>
        Dirección {required && <span style={{ color:'#C62828' }}>*</span>}
        <input
          value={direccion}
          onChange={e => upd('direccion', e.target.value)}
          placeholder="Calle, número, colonia..."
          style={IS}
        />
      </label>

      {/* Referencias */}
      <label style={LS}>
        Referencias / Señas
        <input
          value={referencias}
          onChange={e => upd('referencias', e.target.value)}
          placeholder="Frente a..., edificio, portón..."
          style={IS}
        />
      </label>
    </div>
  );
}
