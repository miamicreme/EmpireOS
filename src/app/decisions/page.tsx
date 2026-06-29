import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import type { Decision } from '@/spine/types';
import { Badge, statusVariant } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

async function getDecisions(): Promise<Decision[]> {
  try {
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return [];
    const { data } = await supabase
      .from('decisions')
      .select('*')
      .eq('user_id', auth.data)
      .order('created_at', { ascending: false });
    return (data ?? []) as Decision[];
  } catch {
    return [];
  }
}

export default async function DecisionsPage() {
  const decisions = await getDecisions();

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Decisions</h1>
          <p className="text-sm text-empire-muted">{decisions.length} total</p>
        </div>
        <Link
          href="/decisions/new"
          className="px-4 py-2 bg-empire-blue text-white text-sm rounded-lg hover:bg-empire-blue/90 transition-colors font-mono"
        >
          + New Decision
        </Link>
      </div>

      {decisions.length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-lg px-4 py-12 text-center">
          <p className="text-empire-muted text-sm font-mono">No decisions yet.</p>
          <Link href="/decisions/new" className="mt-3 inline-block text-sm text-empire-blue hover:underline">
            Create your first decision
          </Link>
        </div>
      ) : (
        <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
          {decisions.map((d) => (
            <Link
              key={d.id}
              href={`/decisions/${d.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-surface-2 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-sm font-medium text-gray-200 group-hover:text-white truncate">
                    {d.title}
                  </p>
                  <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                </div>
                <p className="text-xs text-empire-muted truncate">{d.question}</p>
                {d.recommendation && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    → {d.recommendation}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-mono text-empire-muted">
                  {d.created_at?.slice(0, 10)}
                </p>
                {d.confidence != null && (
                  <p className="text-xs font-mono text-gray-400 mt-0.5">
                    {Math.round(d.confidence * 100)}% conf
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
