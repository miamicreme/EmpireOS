import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6 animate-fade-in">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-gray-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-empire-muted mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
