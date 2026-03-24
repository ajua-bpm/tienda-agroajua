import { createContext, useContext, useState, useEffect } from 'react';
import {
  auth, db,
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
  doc, getDoc, setDoc, onSnapshot, serverTimestamp,
} from '../firebase.js';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // Firebase user
  const [cliente, setCliente] = useState(null);   // t_clientes doc
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubCliente = null;

    const unsubAuth = onAuthStateChanged(auth, async fbUser => {
      // Limpiar listener anterior si cambia el usuario
      if (unsubCliente) { unsubCliente(); unsubCliente = null; }

      setUser(fbUser);
      if (fbUser) {
        // Verificar si existe el perfil, crearlo si no
        const snap = await getDoc(doc(db, 't_clientes', fbUser.uid));
        if (!snap.exists()) {
          const profile = {
            uid:        fbUser.uid,
            email:      fbUser.email,
            nombre:     fbUser.displayName || fbUser.email.split('@')[0],
            tier:       'general',
            listaId:    'general',
            activo:     true,
            creadoEn:   serverTimestamp(),
          };
          await setDoc(doc(db, 't_clientes', fbUser.uid), profile);
        }

        // Listener en tiempo real — detecta cambios de listaId, tier, etc.
        unsubCliente = onSnapshot(doc(db, 't_clientes', fbUser.uid), s => {
          setCliente(s.exists() ? { id: s.id, ...s.data() } : null);
          setLoading(false);
        });
      } else {
        setCliente(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubCliente) unsubCliente();
    };
  }, []);

  const login = (email, pass) => signInWithEmailAndPassword(auth, email, pass);

  const register = async (email, pass, nombre, telefono = '', extra = {}) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const profile = {
      uid:         cred.user.uid,
      email,
      nombre,
      telefono,
      empresa:     extra.empresa     || '',
      tipo:        extra.tipo        || 'individual',   // 'individual' | 'negocio'
      tipoNegocio: extra.tipoNegocio || '',
      sucursales:  [],               // [{ id, nombre, direccion, telefono, contacto }]
      tier:        'general',
      listaId:     'general',
      activo:      true,
      creadoEn:    serverTimestamp(),
    };
    await setDoc(doc(db, 't_clientes', cred.user.uid), profile);
    setCliente({ id: cred.user.uid, ...profile });
    return cred;
  };

  const logout = () => signOut(auth);

  const resetPassword = email => sendPasswordResetEmail(auth, email);

  const isAdmin = () => cliente?.rol === 'admin';
  const tier    = () => cliente?.tier || 'publico';
  const listaId = () => cliente?.listaId || 'general';

  return (
    <Ctx.Provider value={{ user, cliente, loading, login, register, logout, resetPassword, isAdmin, tier, listaId }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
