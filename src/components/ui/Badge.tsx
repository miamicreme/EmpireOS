import type { ReactNode } from 'react';

type Variant = 'green' | 'yellow' | 'red' | 'blue' | 'muted' | 'default';

const VARIANTS: Record<Variant, string> = {
  green: 'bg-empire-green/10 text-empire-green border-empire-green/20',
  yellow: 'bg-empire-yellow/10 text-empire-yellow border-empire-yellow/20',
  red: 'bg-empire-red/10 text-empire-red border-empire-red/20',
  blue: 'bg-empire-blue/10 text-empire-blue border-empire-blue/20',
  muted: 'bg-surface-2 text-empire-muted border-border',
  default: 'bg-surface-2 text-gray-300 border-border',
};

export function Badge({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}

export function healthVariant(health: string): Variant {
  if (health === 'green') return 'green';
  if (health === 'yellow') return 'yellow';
  if (health === 'red') return 'red';
  return 'muted';
}

export function statusVariant(status: string): Variant {
  const map: Record<string, Variant> = {
    open: 'blue',
    in_progress: 'yellow',
    blocked: 'red',
    done: 'green',
    draft: 'muted',
    analyzing: 'yellow',
    decided: 'green',
    archived: 'muted',
  };
  return map[status] ?? 'default';
}
