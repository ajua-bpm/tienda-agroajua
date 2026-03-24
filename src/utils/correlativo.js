/**
 * Generates the next OC correlativo: OC-YYYY-NNNN
 * Uses Firestore transaction on t_config/contadores to avoid duplicates.
 */
import { db, doc, runTransaction } from '../firebase.js';

export async function nextCorrelativo(tipo = 'OC') {
  const year = new Date().getFullYear();
  const ref  = doc(db, 't_config', 'contadores');

  const nuevo = await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const key  = `${tipo}_${year}`;
    const n    = (data[key] || 0) + 1;
    tx.set(ref, { ...data, [key]: n }, { merge: true });
    return n;
  });

  const pad = String(nuevo).padStart(4, '0');
  return `${tipo}-${year}-${pad}`;
}

/**
 * Generates next client code: CLI-NNNN (global, not per year)
 */
export async function nextClienteCodigo() {
  const ref = doc(db, 't_config', 'contadores');
  const n = await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const next = (data['CLI'] || 0) + 1;
    tx.set(ref, { ...data, CLI: next }, { merge: true });
    return next;
  });
  return `CLI-${String(n).padStart(4, '0')}`;
}

/**
 * Generates invoice correlativo: FAC-A-YYYY-NNNN
 * Serie is configurable via t_config/facturacion.serie
 */
export async function nextFacturaCorrelativo(serie = 'A') {
  const year = new Date().getFullYear();
  const ref  = doc(db, 't_config', 'contadores');

  const nuevo = await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const key  = `FAC_${year}`;
    const n    = (data[key] || 0) + 1;
    tx.set(ref, { ...data, [key]: n }, { merge: true });
    return n;
  });

  const pad = String(nuevo).padStart(4, '0');
  return `FAC-${serie}-${year}-${pad}`;
}
