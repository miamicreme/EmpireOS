import type { EmpireScoreResult } from '@/spine/types';

function gradeColor(grade: string) {
  if (grade === 'green') return 'text-empire-green';
  if (grade === 'yellow') return 'text-empire-yellow';
  return 'text-empire-red';
}

function gradeGlow(grade: string) {
  if (grade === 'green') return 'shadow-empire-green/20';
  if (grade === 'yellow') return 'shadow-empire-yellow/20';
  return 'shadow-empire-red/20';
}

function BreakdownBar({
  label,
  value,
  max,
  grade,
}: {
  label: string;
  value: number;
  max: number;
  grade: string;
}) {
  const pct = Math.round((value / max) * 100);
  const barColor =
    grade === 'green'
      ? 'bg-empire-green'
      : grade === 'yellow'
      ? 'bg-empire-yellow'
      : 'bg-empire-red';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-empire-muted font-mono w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-surface-3 rounded-full h-1.5">
        <div
          className={`${barColor} h-1.5 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-400 w-8 text-right">{value.toFixed(0)}</span>
    </div>
  );
}

export function EmpireScoreCard({
  result,
  date,
}: {
  result: EmpireScoreResult | null;
  date: string;
}) {
  const score = result?.score ?? 0;
  const grade = result?.grade ?? 'red';
  const breakdown = result?.breakdown;

  return (
    <div
      className={`bg-surface-1 border border-border rounded-[14px] p-5 shadow-card ${gradeGlow(grade)}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-mono text-empire-muted tracking-widest uppercase">Empire Score</p>
          <p className="text-xs text-empire-muted mt-0.5">{date}</p>
        </div>
        <span
          className={`text-xs font-mono uppercase px-2 py-0.5 rounded border ${
            grade === 'green'
              ? 'border-empire-green/30 text-empire-green bg-empire-green/10'
              : grade === 'yellow'
              ? 'border-empire-yellow/30 text-empire-yellow bg-empire-yellow/10'
              : 'border-empire-red/30 text-empire-red bg-empire-red/10'
          }`}
        >
          {grade}
        </span>
      </div>

      <div className={`text-7xl font-mono font-bold leading-none mb-5 ${gradeColor(grade)}`}>
        {score}
        <span className="text-2xl text-empire-muted">/100</span>
      </div>

      {breakdown && (
        <div className="space-y-2">
          <BreakdownBar label="Cash" value={breakdown.cash} max={30} grade={grade} />
          <BreakdownBar label="Actions" value={breakdown.actions} max={25} grade={grade} />
          <BreakdownBar label="Job Hunt" value={breakdown.jobHunt} max={20} grade={grade} />
          <BreakdownBar label="Follow-ups" value={breakdown.followUps} max={15} grade={grade} />
          <BreakdownBar label="Review" value={breakdown.review} max={10} grade={grade} />
        </div>
      )}

      {!result && (
        <p className="text-xs font-mono text-empire-muted">
          No score data — connect Supabase to start tracking.
        </p>
      )}
    </div>
  );
}
