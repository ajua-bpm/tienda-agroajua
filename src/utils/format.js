/** Format currency Q 1,234.56 */
export const fmtQ = (n, dec = 2) =>
  'Q ' + (Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Format number with thousand separators */
export const fmtN = (n, dec = 0) =>
  (Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Format date string YYYY-MM-DD → DD/MM/YYYY */
export const fmtDate = d => {
  if (!d) return '—';
  if (typeof d === 'string') {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  if (d?.toDate) return fmtDate(d.toDate().toISOString().slice(0, 10));
  return '—';
};

/** Today as YYYY-MM-DD */
export const today = () => new Date().toISOString().slice(0, 10);

/** Now as HH:MM */
export const nowTime = () => new Date().toTimeString().slice(0, 5);

/** Capitalize first letter */
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';

/** Estado badge color */
export const estadoColor = estado => {
  const map = {
    nueva:       { bg: '#E3F2FD', color: '#1565C0' },
    confirmada:  { bg: '#E8F5E9', color: '#1B5E20' },
    aprobada:    { bg: '#F3E5F5', color: '#6A1B9A' },
    preparando:  { bg: '#FFF3E0', color: '#E65100' },
    en_ruta:     { bg: '#FFF8E1', color: '#F57F17' },
    entregada:   { bg: '#E8F5E9', color: '#2E7D32' },
    facturada:   { bg: '#E3F2FD', color: '#0D47A1' },
    pagada:      { bg: '#E8F5E9', color: '#1B5E20' },
    cancelada:   { bg: '#FFEBEE', color: '#C62828' },
  };
  return map[estado] || { bg: '#F5F5F5', color: '#555' };
};

export const ESTADOS_ORDEN = [
  'nueva', 'confirmada', 'aprobada', 'preparando', 'en_ruta', 'entregada', 'facturada', 'pagada', 'cancelada',
];

export const TIER_LABEL = { publico: 'Público', general: 'General', negociado: 'Negociado' };
export const TIER_COLOR = {
  publico:   { bg: '#F5F5F5', color: '#555' },
  general:   { bg: '#E8F5E9', color: '#1B5E20' },
  negociado: { bg: '#FFF3E0', color: '#E65100' },
};
