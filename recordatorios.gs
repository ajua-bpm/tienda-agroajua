/**
 * recordatorios.gs — Google Apps Script
 * Ejecutar diario a las 7:00am con un Time-driven trigger.
 *
 * Configuración:
 *   1. Ir a script.google.com → Nuevo proyecto
 *   2. Pegar este código
 *   3. Editar las constantes de la sección CONFIG
 *   4. Agregar trigger: Editar → Disparadores → + Agregar → Diario, 7-8am
 *
 * Requiere: acceso a Firebase REST API (Firestore) con una clave de servicio.
 * Alternativa más simple: usar Firebase Admin SDK con Node.js + Cloud Scheduler.
 */

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const FIREBASE_PROJECT = 'ajuabmp';
const ADMIN_EMAIL      = 'agroajua@gmail.com';
const DIAS_ANTICIPO    = 3;   // Recordar X días antes de vencer

// Firebase REST API base
const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// ─── MAIN ──────────────────────────────────────────────────────────────────────
function enviarRecordatorios() {
  const hoy      = new Date();
  const limite   = new Date(hoy);
  limite.setDate(limite.getDate() + DIAS_ANTICIPO);
  const hoyStr   = formatDate(hoy);
  const limiteStr = formatDate(limite);

  Logger.log(`Ejecutando recordatorios. Hoy: ${hoyStr}, límite: ${limiteStr}`);

  // Obtener órdenes con pago pendiente
  const ordenes = getOrdenesPendientes();
  Logger.log(`Órdenes pendientes encontradas: ${ordenes.length}`);

  let enviados = 0;

  for (const orden of ordenes) {
    const fechaPago = orden.fechaPagoPromesada;
    if (!fechaPago) continue;

    // Solo órdenes que vencen dentro del periodo
    if (fechaPago < hoyStr || fechaPago > limiteStr) continue;

    // Verificar si ya se envió recordatorio reciente
    if (yaEnvioRecordatorio(orden.id, fechaPago)) {
      Logger.log(`Skipping ${orden.id} — recordatorio ya enviado`);
      continue;
    }

    const diasRestantes = diasEntre(hoy, fechaPago);
    const emailCliente  = orden.email || '';
    const emailAdmin    = ADMIN_EMAIL;
    const monto         = formatQ(orden.total || 0);
    const correlativo   = orden.correlativo || orden.id;
    const nombreCliente = orden.nombre || orden.empresa || 'Cliente';

    // Email al cliente
    if (emailCliente) {
      const asunto = `Recordatorio de pago — ${correlativo}`;
      const cuerpo = `
Estimado/a ${nombreCliente},

Le recordamos que tiene un pago pendiente:

  Orden de compra: ${correlativo}
  Monto:           ${monto}
  Fecha de vencimiento: ${formatDateGT(fechaPago)} (en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''})

Para cualquier consulta, escríbanos a: ${ADMIN_EMAIL}

Gracias por su preferencia.

Agroindustria AJÚA
Guatemala
      `.trim();

      try {
        MailApp.sendEmail(emailCliente, asunto, cuerpo);
        Logger.log(`Email enviado a cliente: ${emailCliente} — ${correlativo}`);
      } catch (e) {
        Logger.log(`Error email cliente: ${e.message}`);
      }
    }

    // Email al admin
    const asuntoAdmin = `Cobro pendiente — ${nombreCliente} — ${correlativo}`;
    const cuerpoAdmin = `
Recordatorio de cobro pendiente:

  Cliente:         ${nombreCliente}
  Orden:           ${correlativo}
  Monto:           ${monto}
  Vencimiento:     ${formatDateGT(fechaPago)} (en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''})
  Email cliente:   ${emailCliente || 'no registrado'}
    `.trim();

    try {
      MailApp.sendEmail(emailAdmin, asuntoAdmin, cuerpoAdmin);
      Logger.log(`Email enviado a admin: ${correlativo}`);
    } catch (e) {
      Logger.log(`Error email admin: ${e.message}`);
    }

    // Marcar recordatorio como enviado en Firestore (opcional — requiere autenticación)
    // registrarRecordatorio(orden.id, fechaPago);

    enviados++;
  }

  Logger.log(`Recordatorios enviados: ${enviados}`);
}

// ─── Trigger para pagos VENCIDOS (correr diario también) ───────────────────────
function reportarVencidos() {
  const hoyStr  = formatDate(new Date());
  const ordenes = getOrdenesPendientes();
  const vencidas = ordenes.filter(o => o.fechaPagoPromesada && o.fechaPagoPromesada < hoyStr);

  if (!vencidas.length) return;

  const lineas = vencidas.map(o =>
    `  ${o.correlativo||o.id} — ${o.nombre||o.empresa||'?'} — ${formatQ(o.total)} — vence ${formatDateGT(o.fechaPagoPromesada)}`
  ).join('\n');

  const asunto = `⚠ ${vencidas.length} pago${vencidas.length !== 1 ? 's' : ''} vencido${vencidas.length !== 1 ? 's' : ''} — AJÚA`;
  const cuerpo = `Pagos vencidos al ${formatDateGT(hoyStr)}:\n\n${lineas}\n\nRevisa el portal: https://tienda.agroajua.com/admin/calendario`;

  try {
    MailApp.sendEmail(ADMIN_EMAIL, asunto, cuerpo);
    Logger.log(`Reporte de vencidos enviado: ${vencidas.length} órdenes`);
  } catch (e) {
    Logger.log(`Error: ${e.message}`);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Obtiene órdenes con estado 'entregada' o 'facturada' (pago pendiente).
 * Usa Firestore REST API. Requiere que el script tenga OAuth scope para Firestore
 * o usa una Service Account con clave exportada.
 *
 * NOTA: Para proyectos de esta escala, la forma más simple es exportar
 * un JSON de órdenes desde la UI o usar un Cloud Function que llame a este script.
 * El código siguiente es un esqueleto funcional si configurás OAuth.
 */
function getOrdenesPendientes() {
  // OPCIÓN A — Hardcoded para demo (reemplazar con llamada real)
  // return [];

  // OPCIÓN B — Firestore REST (requiere OAuth con scope firestore)
  try {
    const token = ScriptApp.getOAuthToken();
    const url   = `${FIREBASE_URL}/t_ordenes?pageSize=500`;
    const res   = UrlFetchApp.fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('Error Firestore: ' + res.getContentText());
      return [];
    }
    const json = JSON.parse(res.getContentText());
    const docs = json.documents || [];
    return docs.map(docToObject).filter(o =>
      ['entregada','facturada'].includes(o.estado) && o.fechaPagoPromesada
    );
  } catch (e) {
    Logger.log('Error getOrdenesPendientes: ' + e.message);
    return [];
  }
}

/**
 * Convierte documento Firestore REST al objeto JS.
 */
function docToObject(doc) {
  const fields = doc.fields || {};
  const id     = (doc.name || '').split('/').pop();
  const obj    = { id };
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue  !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue);
    else if (v.doubleValue  !== undefined) obj[k] = v.doubleValue;
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) obj[k] = v.timestampValue;
  }
  return obj;
}

/**
 * Verifica en PropertiesService si ya se envió recordatorio para esta orden+fecha.
 */
function yaEnvioRecordatorio(ordenId, fechaPago) {
  const props = PropertiesService.getScriptProperties();
  const key   = `rec_${ordenId}_${fechaPago}`;
  return props.getProperty(key) === 'sent';
}

function registrarRecordatorio(ordenId, fechaPago) {
  const props = PropertiesService.getScriptProperties();
  const key   = `rec_${ordenId}_${fechaPago}`;
  props.setProperty(key, 'sent');
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function formatDateGT(isoStr) {
  if (!isoStr) return '—';
  const [y, m, day] = isoStr.split('-');
  return `${day}/${m}/${y}`;
}

function formatQ(n) {
  return 'Q ' + (Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function diasEntre(desde, hastaStr) {
  const hasta = new Date(hastaStr + 'T12:00:00');
  const diff  = hasta - desde;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}
