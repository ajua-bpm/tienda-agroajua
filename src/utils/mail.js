/**
 * Email notifications via Firebase Trigger Email Extension.
 * Writes to `mail` collection — Extension picks it up and sends.
 *
 * Setup (one-time, in Firebase Console):
 *   Extensions → Trigger Email from Firestore
 *   Collection: "mail"
 *   SMTP: your provider (SendGrid, Gmail SMTP, etc.)
 *
 * If extension is not yet installed, documents are simply stored but not sent.
 * When installed, past queued docs in `mail` will also be delivered.
 */
import { db, collection, addDoc, serverTimestamp } from '../firebase.js';
import { fmtQ } from './format.js';

const ADMIN_EMAIL = 'agroajua@gmail.com';

// ── Send via `mail` collection ────────────────────────────────────────────────
async function sendMail({ to, subject, html }) {
  try {
    await addDoc(collection(db, 'mail'), {
      to,
      message: { subject, html },
      creadoEn: serverTimestamp(),
    });
  } catch (err) {
    // Non-fatal — never throw from email functions
    console.warn('[mail] Failed to queue email:', err.message);
  }
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
const header = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1A3D28;color:#F5F0E4;padding:20px 28px">
    <h1 style="margin:0;font-size:1.1rem;font-weight:800">AJÚA Tienda</h1>
    <p style="margin:4px 0 0;font-size:.8rem;opacity:.8">tienda.agroajua.com</p>
  </div>
  <div style="padding:24px 28px;background:#fff">`;

const footer = `
  </div>
  <div style="background:#F5F5F0;padding:14px 28px;font-size:.75rem;color:#888">
    AGROINDUSTRIA AJÚA · Guatemala · <a href="mailto:${ADMIN_EMAIL}" style="color:#1A3D28">${ADMIN_EMAIL}</a>
  </div>
  </div>`;

function itemsTable(items) {
  const rows = items.map(i => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #F0F0EC">${i.nombre}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #F0F0EC;text-align:center">${i.cantidad} ${i.unidad}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #F0F0EC;text-align:right;font-weight:700;color:#2D6645">${fmtQ(i.subtotal)}</td>
    </tr>`).join('');
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:.85rem">
      <thead>
        <tr style="background:#F5F5F0">
          <th style="padding:8px 10px;text-align:left;font-size:.72rem;text-transform:uppercase;color:#555">Producto</th>
          <th style="padding:8px 10px;text-align:center;font-size:.72rem;text-transform:uppercase;color:#555">Cantidad</th>
          <th style="padding:8px 10px;text-align:right;font-size:.72rem;text-transform:uppercase;color:#555">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:10px;font-weight:800;text-align:right">TOTAL</td>
          <td style="padding:10px;font-weight:800;text-align:right;color:#1A3D28;font-size:1rem">${fmtQ(items.reduce((s,i) => s + (i.subtotal ?? 0), 0))}</td>
        </tr>
      </tfoot>
    </table>`;
}

// ── 1. New order → admin ──────────────────────────────────────────────────────
export async function notifyNuevoPedido(orden) {
  const dir = orden.direccionStr || orden.direccion?.direccion || '';
  await sendMail({
    to: ADMIN_EMAIL,
    subject: `🛒 Nuevo pedido ${orden.correlativo} — ${orden.nombre}`,
    html: `${header}
      <h2 style="color:#1A3D28;margin-top:0">Nuevo pedido recibido</h2>
      <table style="font-size:.85rem;width:100%">
        <tr><td style="color:#888;padding:3px 0;width:120px">Correlativo</td><td><strong>${orden.correlativo}</strong></td></tr>
        <tr><td style="color:#888;padding:3px 0">Cliente</td><td>${orden.nombre}${orden.empresa ? ` · ${orden.empresa}` : ''}</td></tr>
        <tr><td style="color:#888;padding:3px 0">Teléfono</td><td>${orden.telefono || '—'}</td></tr>
        <tr><td style="color:#888;padding:3px 0">Email</td><td>${orden.email || '—'}</td></tr>
        <tr><td style="color:#888;padding:3px 0">Entrega</td><td>${orden.fechaEntrega || '—'}</td></tr>
        <tr><td style="color:#888;padding:3px 0">Dirección</td><td>${dir || '—'}</td></tr>
        ${orden.notas ? `<tr><td style="color:#888;padding:3px 0">Notas</td><td>${orden.notas}</td></tr>` : ''}
      </table>
      ${itemsTable(orden.items || [])}
      <p style="font-size:.8rem;color:#888;margin-top:16px">Ingresá al panel admin para confirmar el pedido.</p>
    ${footer}`,
  });
}

// ── 2. Order status change → client ──────────────────────────────────────────
const ESTADO_INFO = {
  confirmada:  { emoji:'✅', label:'Confirmado',     msg:'Tu pedido fue confirmado y está siendo procesado.' },
  preparando:  { emoji:'📦', label:'En preparación', msg:'Estamos preparando tu pedido.' },
  en_ruta:     { emoji:'🚚', label:'En ruta',        msg:'Tu pedido va en camino. Pronto recibirás tu entrega.' },
  entregada:   { emoji:'🎉', label:'Entregado',      msg:'Tu pedido fue entregado. ¡Gracias por tu compra!' },
  cancelada:   { emoji:'❌', label:'Cancelado',      msg:'Tu pedido fue cancelado. Contactanos si tenés alguna duda.' },
};

export async function notifyCambioEstado(orden, nuevoEstado) {
  if (!orden.email) return;
  const info = ESTADO_INFO[nuevoEstado];
  if (!info) return;          // Not a notifiable state

  await sendMail({
    to: orden.email,
    subject: `${info.emoji} Pedido ${orden.correlativo} — ${info.label}`,
    html: `${header}
      <h2 style="color:#1A3D28;margin-top:0">${info.emoji} ${info.label}</h2>
      <p style="margin-top:0">Hola <strong>${orden.nombre}</strong>,</p>
      <p>${info.msg}</p>
      <div style="background:#F5F5F0;border-radius:6px;padding:14px 18px;margin:16px 0;font-size:.85rem">
        <div><strong>Pedido:</strong> ${orden.correlativo}</div>
        <div style="margin-top:4px"><strong>Fecha de entrega:</strong> ${orden.fechaEntrega || '—'}</div>
        <div style="margin-top:4px"><strong>Total:</strong> ${fmtQ(orden.total)}</div>
      </div>
      ${nuevoEstado === 'entregada' ? itemsTable(orden.items || []) : ''}
      <p style="font-size:.8rem;color:#888">¿Preguntas? Escribinos a <a href="mailto:${ADMIN_EMAIL}" style="color:#1A3D28">${ADMIN_EMAIL}</a></p>
    ${footer}`,
  });
}
