'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++;
      setToasts((cur) => [...cur, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const api: ToastApi = {
    toast,
    success: (m) => toast(m, 'success'),
    error: (m) => toast(m, 'error'),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2.5rem)]">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS: Record<ToastKind, string> = { success: '✓', error: '✕', info: 'ℹ' };
const ACCENT: Record<ToastKind, string> = {
  success: 'border-l-empire-green text-empire-green',
  error: 'border-l-empire-red text-empire-red',
  info: 'border-l-empire-blue text-empire-blue',
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 3700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={cn(
        'flex items-start gap-3 bg-surface-2 border border-border border-l-2 rounded-lg px-3.5 py-3 shadow-card-hover',
        'transition-all duration-300',
        leaving ? 'opacity-0 translate-x-3' : 'animate-slide-in',
        ACCENT[toast.kind],
      )}
      role="status"
    >
      <span className="font-mono text-sm leading-5">{ICONS[toast.kind]}</span>
      <p className="flex-1 text-sm text-gray-200 leading-5">{toast.message}</p>
      <button
        onClick={onClose}
        className="text-empire-muted hover:text-gray-200 text-xs transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
