'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';

type RunDetail = {
  run: {
    id: string;
    user_command: string;
    status: string;
    runtime_path: string;
    final_summary: string | null;
    confidence: number | null;
    risk_level: string | null;
    needs_memory: boolean;
    needs_research: boolean;
    needs_approval: boolean;
    cost_estimate: number | null;
    latency_ms: number | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
  };
  events: Array<{ id: string; event_order: number; event_type: string; status: string; summary: string | null; latency_ms: number | null; created_at: string }>;
  artifacts: Array<{
    id: string;
    artifact_type: string;
    title: string | null;
    summary: string | null;
    confidence: number | null;
    risk_level: string | null;
    status: string;
    created_at: string;
    content_json?: Record<string, unknown>;
  }>;
  actionDrafts: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    priority: string;
    approval_status: 'pending' | 'approved' | 'rejected';
  }>;
  providerRuns: Array<{
    id: string;
    provider: string;
    model: string;
    runtime_class: string | null;
    status: string;
    latency_ms: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    cost_estimate: number | null;
    error_code: string | null;
    fallback_used: boolean;
    created_at: string;
  }>;
};

type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'correction' | 'save_memory' | 'never_again';

function fmtDate(value: string | null) {
  if (!value) return 'n/a';
  return new Date(value).toLocaleString();
}

function safeInputArtifacts(artifacts: RunDetail['artifacts']) {
  const entries = artifacts.flatMap((artifact) => {
    const raw = artifact.content_json?.inputArtifacts;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is { id?: string; artifactType?: string; title?: string; summary?: string } => Boolean(item))
      .map((item) => ({
        id: item.id ?? `${artifact.id}-input`,
        artifactType: item.artifactType ?? 'artifact',
        title: item.title ?? 'Untitled input',
        summary: item.summary ?? null,
      }));
  });
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

export function RunDetailWorkbench({ runId }: { runId: string }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [busyFeedback, setBusyFeedback] = useState<FeedbackType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await api.get<RunDetail>(`/api/ai/agent/runs/${runId}`);
    if (response.ok) {
      setDetail(response.data);
    } else {
      setError(response.error.message);
    }
    setLoading(false);
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mainArtifact = detail?.artifacts[0] ?? null;
  const reasoningSummary = useMemo(
    () => (mainArtifact?.content_json?.reasoningSummary as string | undefined) ?? null,
    [mainArtifact],
  );
  const inputArtifacts = useMemo(() => safeInputArtifacts(detail?.artifacts ?? []), [detail]);

  async function setDraftStatus(id: string, reject: boolean) {
    setBusyDraftId(id);
    const response = await api.post(`/api/ai/action-drafts/${id}/approve`, reject ? { reject: true } : {});
    setBusyDraftId(null);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    await load();
  }

  async function sendFeedback(feedbackType: FeedbackType) {
    if (!detail) return;
    setBusyFeedback(feedbackType);
    const response = await api.post('/api/ai/agent/feedback', {
      runId: detail.run.id,
      feedbackType,
      shouldSaveAsMemory: feedbackType === 'save_memory',
      neverSuggestAgain: feedbackType === 'never_again',
    });
    setBusyFeedback(null);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    await load();
  }

  if (loading) {
    return <SkeletonRows rows={6} />;
  }

  if (error || !detail) {
    return (
      <Card className="border-empire-red/20">
        <div className="p-5">
          <EmptyState
            icon="!"
            message={error ?? 'Run detail not available.'}
          />
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
      <section className="space-y-5">
        <Card>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="blue">{detail.run.status}</Badge>
              <Badge variant="muted">{detail.run.runtime_path}</Badge>
              {detail.run.needs_research && <Badge variant="yellow">research required</Badge>}
              {detail.run.needs_memory && <Badge variant="yellow">memory required</Badge>}
              {detail.run.needs_approval && <Badge variant="yellow">approval required</Badge>}
            </div>

            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">User request</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-100">{detail.run.user_command}</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-surface-0 p-3 text-sm text-empire-muted">
                Created
                <div className="mt-1 text-gray-100">{fmtDate(detail.run.created_at)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface-0 p-3 text-sm text-empire-muted">
                Completed
                <div className="mt-1 text-gray-100">{fmtDate(detail.run.completed_at)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface-0 p-3 text-sm text-empire-muted">
                Latency
                <div className="mt-1 text-gray-100">{detail.run.latency_ms ?? 'n/a'} ms</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface-0 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Safe reasoning summary only</p>
              <p className="mt-2 text-sm leading-6 text-gray-100">
                {reasoningSummary ?? 'No safe reasoning summary was stored for this run.'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Input artifacts used</p>
            {inputArtifacts.length === 0 ? (
              <EmptyState message="No attached input artifacts were recorded for this run." />
            ) : (
              <div className="space-y-3">
                {inputArtifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-2xl border border-border bg-surface-0 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="blue">{artifact.artifactType}</Badge>
                      <Badge variant="muted">{artifact.id}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-gray-100">{artifact.title}</p>
                    {artifact.summary && <p className="mt-1 text-sm text-empire-muted">{artifact.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-4 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Event summaries</p>
            {detail.events.length === 0 ? (
              <EmptyState message="No run events were recorded." />
            ) : (
              <div className="space-y-3">
                {detail.events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-border bg-surface-0 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-100">{event.event_type}</p>
                      <Badge variant="muted">{event.status}</Badge>
                    </div>
                    {event.summary && <p className="mt-2 text-sm text-empire-muted">{event.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      <aside className="space-y-5">
        <Card>
          <div className="space-y-4 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Created artifact</p>
            {mainArtifact ? (
              <div className="rounded-2xl border border-border bg-surface-0 p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="blue">{mainArtifact.artifact_type}</Badge>
                  <Badge variant="muted">{mainArtifact.status}</Badge>
                </div>
                {mainArtifact.title && <p className="mt-2 text-sm text-gray-100">{mainArtifact.title}</p>}
                {mainArtifact.summary && <p className="mt-1 text-sm text-empire-muted">{mainArtifact.summary}</p>}
              </div>
            ) : (
              <EmptyState message="No artifact was stored with this run." />
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-4 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Provider / model / cost / latency</p>
            {detail.providerRuns.length === 0 ? (
              <EmptyState message="No provider runs were recorded." />
            ) : (
              <div className="space-y-3">
                {detail.providerRuns.map((run) => (
                  <div key={run.id} className="rounded-2xl border border-border bg-surface-0 p-4 text-sm text-gray-100">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="blue">{run.provider}</Badge>
                      <Badge variant="muted">{run.model}</Badge>
                      <Badge variant="muted">{run.status}</Badge>
                    </div>
                    <p className="mt-2 text-empire-muted">
                      Latency: {run.latency_ms ?? 'n/a'} ms · Cost: {run.cost_estimate ?? 'n/a'} · Fallback: {run.fallback_used ? 'yes' : 'no'}
                    </p>
                    {run.error_code && <p className="mt-1 text-empire-red">Error: {run.error_code}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-4 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Action drafts</p>
            {detail.actionDrafts.length === 0 ? (
              <EmptyState message="No action drafts were created for this run." />
            ) : (
              <div className="space-y-3">
                {detail.actionDrafts.map((draft) => (
                  <div key={draft.id} className="rounded-2xl border border-border bg-surface-0 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="blue">{draft.approval_status}</Badge>
                      <Badge variant="muted">{draft.category}</Badge>
                      <Badge variant="muted">{draft.priority}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-gray-100">{draft.title}</p>
                    {draft.description && <p className="mt-1 text-sm text-empire-muted">{draft.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void setDraftStatus(draft.id, false)} loading={busyDraftId === draft.id}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void setDraftStatus(draft.id, true)} loading={busyDraftId === draft.id}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-4 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Feedback controls</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={busyFeedback === 'thumbs_up'} onClick={() => void sendFeedback('thumbs_up')}>
                Helpful
              </Button>
              <Button size="sm" variant="secondary" loading={busyFeedback === 'thumbs_down'} onClick={() => void sendFeedback('thumbs_down')}>
                Needs correction
              </Button>
              <Button size="sm" variant="secondary" loading={busyFeedback === 'save_memory'} onClick={() => void sendFeedback('save_memory')}>
                Save memory
              </Button>
              <Button size="sm" variant="ghost" loading={busyFeedback === 'never_again'} onClick={() => void sendFeedback('never_again')}>
                Never suggest again
              </Button>
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}
