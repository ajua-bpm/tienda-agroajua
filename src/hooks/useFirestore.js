import { useState, useEffect, useCallback } from 'react';
import {
  db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, limit, onSnapshot, serverTimestamp,
} from '../firebase.js';

/**
 * Real-time collection listener.
 * opts: { orderField, orderDir, limitN }
 */
export function useCollection(colName, opts = {}) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!colName) { setData([]); setLoading(false); return; }
    let q = collection(db, colName);
    const constraints = [];
    if (opts.orderField) constraints.push(orderBy(opts.orderField, opts.orderDir || 'asc'));
    if (opts.limitN)     constraints.push(limit(opts.limitN));
    if (constraints.length) q = query(q, ...constraints);

    const unsub = onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => { setData([]); setLoading(false); });

    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colName]);

  return { data, loading };
}

/**
 * Write operations for a collection.
 */
export function useWrite(colName) {
  const [saving, setSaving] = useState(false);

  const add = useCallback(async data => {
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, colName), { ...data, creadoEn: serverTimestamp() });
      return ref.id;
    } finally { setSaving(false); }
  }, [colName]);

  const set = useCallback(async (id, data) => {
    setSaving(true);
    try {
      await setDoc(doc(db, colName, id), { ...data, actualizadoEn: serverTimestamp() }, { merge: true });
    } finally { setSaving(false); }
  }, [colName]);

  const update = useCallback(async (id, data) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, colName, id), { ...data, actualizadoEn: serverTimestamp() });
    } finally { setSaving(false); }
  }, [colName]);

  const remove = useCallback(async id => {
    setSaving(true);
    try { await deleteDoc(doc(db, colName, id)); }
    finally { setSaving(false); }
  }, [colName]);

  return { add, set, update, remove, saving };
}
