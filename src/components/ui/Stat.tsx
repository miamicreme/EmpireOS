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
  muted: 'text-gray-200',
};

const TONE_STROKE: Record<Tone, string> = {
  green: '#34d399',
  yellow: '#fbbf24',
  red: '#f87171',
  blue: '#60a5fa',
  violet: '#a78bfa',
  cyan: '#22d3ee',
  muted: '#7d8590',
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
    <div className="group relative bg-surface-1 border border-border rounded-xl p-4 overflow-hidden transition-colors hover:border-border-strong">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-empire-muted uppercase tracking-wider">{label}</span>
        {icon && <span className="text-empire-muted">{icon}</span>}
      </div>
      <div className={cn('mt-2 text-2xl font-semibold nums', TONE_TEXT[tone])}>{value}</div>
      {sub && <div className="mt-1 text-xs text-empire-muted nums">{sub}</div>}
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1d212a" strokeWidth={stroke} />
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
