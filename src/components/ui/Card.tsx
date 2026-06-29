import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-surface-1 border border-border rounded-xl shadow-card',
        hover && 'transition-all duration-200 hover:border-border-strong hover:shadow-card-hover',
        className,
      )}
    >
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
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-100 truncate">{title}</h2>
        {subtitle && <p className="text-xs text-empire-muted mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-3">{action}</div>}
    </div>
  );
}

export function EmptyState({
  message,
  icon,
  action,
}: {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="text-3xl text-empire-muted/60 mb-3">{icon}</div>}
      <p className="text-empire-muted text-sm font-mono">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
