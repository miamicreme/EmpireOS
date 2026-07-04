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
    <div className="flex items-end justify-between gap-4 mb-7 animate-fade-in">
      <div className="min-w-0">
        <div className="eos-eyebrow mb-2">Command surface</div>
        <h1 className="text-2xl sm:text-[26px] font-semibold text-gray-100 tracking-[-0.02em] leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-empire-muted mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
