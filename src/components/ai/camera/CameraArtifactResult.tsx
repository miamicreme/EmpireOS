'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Badge } from '@/components/ui/Badge';
import { Card, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { InputAnalyzeResult } from '../input/InputArtifactResult';

type AgentRunResult = {
  runId: string;
  status: string;
  answer: string;
  actionDrafts: Array<{
    id: string;
    title: string;
    category: string;
    priority: string;
    approvalStatus: string;
  }>;
};

export function CameraArtifactResult({
  snapshotName,
  snapshotResult,
  frameResult,
  runResult,
  error,
  onSendToAgent,
}: {
  snapshotName: string | null;
  snapshotResult: InputAnalyzeResult | null;
  frameResult: InputAnalyzeResult | null;
  runResult: AgentRunResult | null;
  error: string | null;
  onSendToAgent: () => void;
}) {
  const result = snapshotResult ?? frameResult;

  return (
    <section className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Camera artifact</p>
          <h2 className="mt-2 text-xl font-semibold text-gray-100">Artifact summary and safe run handoff</h2>
        </div>
        <p className="text-xs font-mono text-empire-muted">Snapshot: {snapshotName ?? 'none'}</p>
      </div>

      <div className="mt-4 space-y-4">
        {error && (
          <div className="rounded-2xl border border-empire-red/30 bg-empire-red/10 p-4 text-sm text-empire-red">
            {error}
          </div>
        )}

        {!result ? (
          <EmptyState
            icon="◌"
            message="Capture a snapshot or sample frames to create a visual artifact."
          />
        ) : (
          <Card>
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="blue">{result.artifactType}</Badge>
                <Badge variant="muted">{result.artifactId}</Badge>
              </div>

              <div className="rounded-2xl border border-border bg-surface-0 p-4">
                <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Summary</p>
                <p className="mt-2 text-sm leading-6 text-gray-100">{result.summary}</p>
              </div>

              {result.recommendedActions.length > 0 && (
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Recommended actions</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-200">
                    {result.recommendedActions.map((action) => (
                      <li key={action} className="rounded-xl border border-border bg-surface-0 px-3 py-2">
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={onSendToAgent} disabled={!result.artifactId}>
                  Send to Agent
                </Button>
                {runResult?.runId ? (
                  <Link
                    href={`/ai/runs/${runResult.runId}` as Route}
                    className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm text-gray-200 hover:border-empire-blue/50"
                  >
                    Open latest run
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm text-empire-muted">
                    No run yet
                  </span>
                )}
              </div>

              {runResult && (
                <div className="rounded-2xl border border-border bg-surface-0 p-4">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Latest run</p>
                  <p className="mt-2 text-sm text-gray-100">Run ID: {runResult.runId}</p>
                  <p className="mt-1 text-sm text-gray-100">Status: {runResult.status}</p>
                  <p className="mt-2 text-sm text-empire-muted">{runResult.answer}</p>
                  {runResult.actionDrafts.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm text-gray-200">
                      {runResult.actionDrafts.map((draft) => (
                        <li key={draft.id} className="rounded-xl border border-border bg-surface-1 px-3 py-2">
                          {draft.title} · {draft.category} · {draft.priority} · {draft.approvalStatus}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}
