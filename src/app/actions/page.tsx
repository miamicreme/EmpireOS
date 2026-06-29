import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { getRankedActions } from '@/spine/actions/action.service';
import type { GlobalAction } from '@/spine/types';
import { Badge, statusVariant } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

async function getActions(): Promise<GlobalAction[]> {
  try {
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return [];
    const result = await getRankedActions(supabase, auth.data);
    return result.ok ? result.data : [];
  } catch {
    return [];
  }
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-empire-red',
  high: 'text-empire-yellow',
  medium: 'text-gray-300',
  low: 'text-empire-muted',
};

function RankMeter({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, ((score + 10) / 31) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-surface-3 rounded-full h-1.5">
        <div className="bg-empire-blue h-1.5 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-empire-muted w-8">{score.toFixed(1)}</span>
    </div>
  );
}

export default async function ActionsPage() {
  const actions = await getActions();

  const byStatus = {
    in_progress: actions.filter((a) => a.status === 'in_progress'),
    open: actions.filter((a) => a.status === 'open'),
    blocked: actions.filter((a) => a.status === 'blocked'),
  };

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Action Queue</h1>
          <p className="text-sm text-empire-muted">
            {byStatus.in_progress.length} in progress · {byStatus.open.length} open · {byStatus.blocked.length} blocked
          </p>
        </div>
        <Link
          href="/actions/new"
          className="px-4 py-2 bg-empire-blue text-white text-sm rounded-lg hover:bg-empire-blue/90 transition-colors font-mono"
        >
          + New Action
        </Link>
      </div>

      {actions.length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-lg px-4 py-12 text-center">
          <p className="text-empire-muted text-sm font-mono">No open actions.</p>
        </div>
      ) : (
        <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_80px_120px_100px] gap-4 px-4 py-2 border-b border-border bg-surface-2">
            <span className="text-xs font-mono text-empire-muted">Action</span>
            <span className="text-xs font-mono text-empire-muted">Status</span>
            <span className="text-xs font-mono text-empire-muted">Priority</span>
            <span className="text-xs font-mono text-empire-muted">Rank</span>
            <span className="text-xs font-mono text-empire-muted">Due</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {actions.map((action) => (
              <div
                key={action.id}
                className="grid grid-cols-[1fr_100px_80px_120px_100px] gap-4 px-4 py-3 hover:bg-surface-2 transition-colors items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{action.title}</p>
                  {action.description && (
                    <p className="text-xs text-empire-muted truncate mt-0.5">{action.description}</p>
                  )}
                </div>
                <div>
                  <Badge variant={statusVariant(action.status)}>{action.status}</Badge>
                </div>
                <div>
                  <span className={`text-xs font-mono ${PRIORITY_COLORS[action.priority] ?? 'text-gray-400'}`}>
                    {action.priority}
                  </span>
                </div>
                <div>
                  <RankMeter score={action.rank_score ?? 0} />
                </div>
                <div>
                  {action.due_at ? (
                    <span className="text-xs font-mono text-gray-400">
                      {action.due_at.slice(0, 10)}
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-empire-muted">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
