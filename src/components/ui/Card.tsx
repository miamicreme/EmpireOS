import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-surface-1 border border-border rounded-lg ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div>
        <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        {subtitle && <p className="text-xs text-empire-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-empire-muted text-sm font-mono">
      {message}
    </div>
  );
}
