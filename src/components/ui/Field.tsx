import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

const BASE =
  'w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-empire-muted ' +
  'transition-colors focus:outline-none focus:border-empire-blue focus:ring-1 focus:ring-empire-blue/40 ' +
  'disabled:opacity-50';

const LABEL = 'block text-[11px] font-mono text-empire-muted mb-1.5 uppercase tracking-wider';

export function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className={LABEL}>
          {label}
          {required && <span className="text-empire-red ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-empire-red font-mono">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-empire-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(BASE, className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(BASE, 'resize-none', className)} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(BASE, 'appearance-none cursor-pointer', className)}>
      {children}
    </select>
  );
}
