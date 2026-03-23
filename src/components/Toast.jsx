import { createContext, useContext, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = 'success', dur = 3000) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), dur);
  }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '11px 22px', borderRadius: 6, fontFamily: 'inherit',
            fontSize: '.85rem', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,.25)',
            background: t.type === 'error' ? '#C62828' : t.type === 'warn' ? '#E65100' : '#1A3D28',
            color: '#fff', whiteSpace: 'nowrap',
          }}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
