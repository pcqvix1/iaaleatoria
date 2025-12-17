
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CloseIcon, AlertTriangleIcon, CheckIcon } from './Icons';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg shadow-lg flex items-start gap-3 animate-fade-in transform transition-all duration-300 ${
              toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/90 text-red-800 dark:text-white border border-red-200 dark:border-red-700' :
              toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/90 text-green-800 dark:text-white border border-green-200 dark:border-green-700' :
              'bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'error' ? <AlertTriangleIcon /> : 
               toast.type === 'success' ? <CheckIcon /> : 
               <div className="w-5 h-5 bg-blue-500 rounded-full" />}
            </div>
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
