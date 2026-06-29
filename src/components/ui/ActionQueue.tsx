import Link from 'next/link';
import type { GlobalAction } from '@/spine/types';
import { Badge, statusVariant } from './Badge';

function RankBar({ score }: { score: number }) {
  // score can be negative; normalise 0..21 range to a percentage
  const pct = Math.max(0, Math.min(100, ((score + 10) / 31) * 100));
  return (
    <div className="w-12 bg-surface-3 rounded-full h-1 shrink-0">
      <div className="bg-empire-blue h-1 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ActionQueue({
  actions,
  limit = 10,
}: {
  actions: GlobalAction[];
  limit?: number;
}) {
  const visible = actions.slice(0, limit);

  if (visible.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-empire-muted font-mono">
        No open actions
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {visible.map((action) => (
        <div key={action.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
          <RankBar score={action.rank_score ?? 0} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-200 truncate">{action.title}</p>
            {action.due_at && (
              <p className="text-xs text-empire-muted font-mono mt-0.5">
                due {action.due_at.slice(0, 10)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={statusVariant(action.status)}>{action.status}</Badge>
            <span className="text-xs font-mono text-empire-muted w-8 text-right">
              {(action.rank_score ?? 0).toFixed(1)}
            </span>
          </div>
        </div>
      ))}
      {actions.length > limit && (
        <div className="px-4 py-2 text-center">
          <Link href="/actions" className="text-xs text-empire-blue hover:underline font-mono">
            View all {actions.length} actions →
          </Link>
        </div>
      )}
    </div>
  );
}
