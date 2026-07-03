'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

type Artifact = {
  id: string;
  artifact_type: string;
  title: string | null;
  summary: string | null;
  confidence: number | null;
  risk_level: string | null;
  content_json?: Record<string, unknown>;
};

type RunDetail = {
  run: { id: string; user_command: string; status: string; runtime_path: string; latency_ms: number | null; cost_estimate: number | null };
  events: Array<{ event_type: string; summary: string | null; created_at: string }>;
  artifacts: Artifact[];
  actionDrafts: Array<{ id: string; title: string; approval_status: string; priority: string; category: string }>;
  providerRuns: Array<{ provider: string; model: string; status: string; latency_ms: number | null; cost_estimate: number | null }>;
};

function inputArtifacts(artifact: Artifact) {
  const content = artifact.content_json ?? {};
  const maybe = content.inputArtifacts;
  return Array.isArray(maybe) ? maybe as Array<{ id?: string; artifactType?: string; title?: string; summary?: string }> : [];
}

export function RunDetailView({ runId }: { runId: string }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<RunDetail>(`/api/ai/agent/runs/${runId}`).then((response) => {
      if (response.ok) setDetail(response.data);
      else setError(response.error.message);
    });
  }, [runId]);

  if (error) return <p className="rounded-xl border border-empire-red/30 bg-empire-red/10 p-4 text-empire-red">{error}</p>;
  if (!detail) return <p className="text-sm text-empire-muted">Loading safe run detail...</p>;

  const createdArtifact = detail.artifacts[0];
  const usedInputs = detail.artifacts.flatMap(inputArtifacts);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-border bg-surface-2/70 p-5">
        <p className="font-mono text-xs uppercase text-empire-muted">User request</p>
        <h2 className="mt-2 text-xl font-semibold text-gray-100">{detail.run.user_command}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-surface-0 p-3 text-sm text-empire-muted">Status<br /><span className="text-gray-100">{detail.run.status}</span></div>
          <div className="rounded-xl bg-surface-0 p-3 text-sm text-empire-muted">Runtime<br /><span className="text-gray-100">{detail.run.runtime_path}</span></div>
          <div className="rounded-xl bg-surface-0 p-3 text-sm text-empire-muted">Latency<br /><span className="text-gray-100">{detail.run.latency_ms ?? 0} ms</span></div>
        </div>
        <div className="mt-5 rounded-xl border border-border bg-surface-0 p-4">
          <p className="font-mono text-xs uppercase text-empire-muted">Created artifact + safe reasoning summary only</p>
          <p className="mt-2 text-gray-100">{createdArtifact?.artifact_type ?? 'No artifact'}</p>
          <p className="mt-2 text-sm text-empire-muted">{createdArtifact?.summary ?? 'No summary available.'}</p>
        </div>
        <div className="mt-5 rounded-xl border border-border bg-surface-0 p-4">
          <p className="font-mono text-xs uppercase text-empire-muted">Input artifacts used</p>
          {usedInputs.length === 0 ? <p className="mt-2 text-sm text-empire-muted">No input artifacts were attached to this run.</p> : (
            <ul className="mt-2 space-y-2 text-sm text-gray-200">{usedInputs.map((input) => <li key={input.id} className="rounded-lg bg-surface-2 p-2">{input.artifactType}: {input.title} — {input.summary}</li>)}</ul>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-border bg-surface-2/70 p-5">
          <p className="font-mono text-xs uppercase text-empire-muted">Provider / model / cost / latency</p>
          {detail.providerRuns.length === 0 ? <p className="mt-2 text-sm text-empire-muted">No provider run rows recorded.</p> : detail.providerRuns.map((run) => (
            <div key={`${run.provider}-${run.model}-${run.status}`} className="mt-2 rounded-xl bg-surface-0 p-3 text-sm text-gray-200">{run.provider} / {run.model} — {run.status} — {run.latency_ms ?? 0} ms — ${run.cost_estimate ?? 0}</div>
          ))}
        </section>
        <section className="rounded-2xl border border-border bg-surface-2/70 p-5">
          <p className="font-mono text-xs uppercase text-empire-muted">Action drafts created</p>
          {detail.actionDrafts.length === 0 ? <p className="mt-2 text-sm text-empire-muted">No drafts created.</p> : detail.actionDrafts.map((draft) => (
            <div key={draft.id} className="mt-2 rounded-xl bg-surface-0 p-3 text-sm text-gray-200">{draft.title} — {draft.category} — {draft.priority} — {draft.approval_status}</div>
          ))}
        </section>
        <section className="rounded-2xl border border-border bg-surface-2/70 p-5">
          <p className="font-mono text-xs uppercase text-empire-muted">Feedback controls</p>
          <div className="mt-3 flex gap-2 text-sm"><button className="rounded-lg border border-border px-3 py-2 text-gray-200">Helpful</button><button className="rounded-lg border border-border px-3 py-2 text-gray-200">Needs correction</button></div>
        </section>
      </aside>
    </div>
  );
}
