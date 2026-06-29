import Link from 'next/link';
import type { Decision } from '@/spine/types';
import { Badge, statusVariant } from './Badge';

export function DecisionList({
  decisions,
  limit = 5,
}: {
  decisions: Decision[];
  limit?: number;
}) {
  const visible = decisions.slice(0, limit);

  if (visible.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-empire-muted font-mono">
        No decisions yet
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {visible.map((d) => (
        <Link
          key={d.id}
          href={`/decisions/${d.id}`}
          className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-200 truncate group-hover:text-white">{d.title}</p>
            <p className="text-xs text-empire-muted font-mono mt-0.5 truncate">{d.question}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
          </div>
        </Link>
      ))}
      {decisions.length > limit && (
        <div className="px-4 py-2 text-center">
          <Link href="/decisions" className="text-xs text-empire-blue hover:underline font-mono">
            View all {decisions.length} decisions →
          </Link>
        </div>
      )}
    </div>
  );
}
