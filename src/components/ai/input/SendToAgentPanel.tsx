'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@/components/ui/Button';

export function SendToAgentPanel({
  canSend,
  sending,
  runId,
  onSend,
}: {
  canSend: boolean;
  sending: boolean;
  runId: string | null;
  onSend: () => void;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-xl">
      <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Single command path</p>
      <h2 className="mt-2 text-xl font-semibold text-gray-100">Send the created artifact to the agent</h2>
      <p className="mt-2 text-sm leading-6 text-empire-muted">
        This uses `POST /api/ai/agent/run` with `inputArtifactIds` and requests draft creation so the
        owner can review the result from a safe run detail page.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onSend} loading={sending} disabled={!canSend}>
          Send to Agent
        </Button>
        {runId && (
          <Link
            href={`/ai/runs/${runId}` as Route}
            className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm text-gray-200 hover:border-empire-blue/50"
          >
            Open latest run
          </Link>
        )}
      </div>
    </section>
  );
}

