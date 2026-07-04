import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'green' | 'yellow' | 'red' | 'blue' | 'violet' | 'cyan' | 'muted';

const TONE_TEXT: Record<Tone, string> = {
  green: 'text-empire-green',
  yellow: 'text-empire-yellow',
  red: 'text-empire-red',
  blue: 'text-empire-blue',
  violet: 'text-empire-violet',
  cyan: 'text-empire-cyan',
  muted: 'text-gray-100',
};

const TONE_STROKE: Record<Tone, string> = {
  green: 'rgb(var(--empire-green))',
  yellow: 'rgb(var(--empire-yellow))',
  red: 'rgb(var(--empire-red))',
  blue: 'rgb(var(--empire-blue))',
  violet: 'rgb(var(--empire-violet))',
  cyan: 'rgb(var(--empire-cyan))',
  muted: 'rgb(var(--empire-muted))',
};

export function StatCard({
  label,
  value,
  sub,
  tone = 'muted',
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="group relative eos-surface rounded-xl p-4 overflow-hidden transition-all hover:border-border-strong hover:shadow-card-hover">
      <div className="absolute inset-x-4 top-0 h-px bg-hairline opacity-60" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-mono text-empire-muted uppercase tracking-[0.24em] truncate">{label}</span>
        {icon && <span className="text-empire-muted font-mono">{icon}</span>}
      </div>
      <div className={cn('mt-2 text-[26px] leading-none font-semibold nums tracking-[-0.01em]', TONE_TEXT[tone])}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-empire-muted nums leading-relaxed">{sub}</div>}
    </div>
  );
}

/** Circular progress ring, 0..1 value. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 6,
  tone = 'blue',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  children?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamped);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-3))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
