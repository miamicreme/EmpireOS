'use client';

import { useEffect, type ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-lg mt-[8vh] bg-surface-1 border border-border-strong rounded-2xl shadow-card-hover animate-scale-in">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-gray-100">{title}</h2>
            {subtitle && <p className="text-xs text-empire-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-empire-muted hover:text-gray-200 transition-colors -mr-1 -mt-1 p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-surface-2/40 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
