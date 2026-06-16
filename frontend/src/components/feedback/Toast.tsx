import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
    setToasts((prev) => {
      if (prev.some((toast) => toast.type === type && toast.message === message)) {
        return prev;
      }

      return [...prev, { id, type, message }].slice(-3);
    });
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      remove(id);
    }, 4000);
  }, [remove]);

  const success = useCallback((msg: string) => add('success', msg), [add]);
  const error = useCallback((msg: string) => add('error', msg), [add]);
  const info = useCallback((msg: string) => add('info', msg), [add]);
  const value = useMemo(
    () => ({ success, error, info, remove }),
    [success, error, info, remove],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="vh-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`vh-toast vh-toast-${toast.type}`}>
            <span className="vh-toast-icon">
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <AlertCircle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
            </span>
            <p className="vh-toast-message">{toast.message}</p>
            <button className="vh-toast-close" onClick={() => remove(toast.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
