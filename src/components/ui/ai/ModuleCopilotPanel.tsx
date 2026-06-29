'use client';

/**
 * Module AI Copilot panel. Drop into any module page with its moduleId.
 * Runs the module-specific copilot and surfaces recommendations + drafted
 * actions the user can approve into the Spine.
 */
import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { ModuleCopilotOutput } from '@/spine/ai/ai.types';

interface Draft {
  id: string;
  title: string;
  category: string;
  priority: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
  return json.data as T;
}

const LABELS: Record<string, string> = {
  'cash-engine': 'Cash AI — how to hit today’s number',
  'job-hunt': 'Job Hunt AI — rank jobs & follow-ups',
  'followup-crm': 'CRM AI — who to contact next',
  'credit-funding': 'Credit/Funding AI — next move',
  projects: 'Projects AI — pause or push',
  acquisitions: 'Acquisitions AI — score deals',
};

export function ModuleCopilotPanel({ moduleId }: { moduleId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ModuleCopilotOutput | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  async function run() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ output: ModuleCopilotOutput; drafts: Draft[] }>(
        `/api/ai/modules/${moduleId}/copilot`,
        { persist: true },
      );
      setOutput(data.output);
      setDrafts(data.drafts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run copilot');
    } finally {
      setLoading(false);
    }
  }

  async function decideDraft(id: string, reject: boolean) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    try {
      await postJson(`/api/ai/action-drafts/${id}/approve`, { reject });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update draft');
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title="AI Copilot"
        subtitle={LABELS[moduleId] ?? 'Module AI'}
        action={
          <Button size="sm" variant="primary" loading={loading} onClick={run}>
            {output ? 'Refresh' : 'Run Copilot'}
          </Button>
        }
      />
      {open && (
        <div className="p-4 space-y-4">
          {error && <p className="text-xs text-empire-red font-mono">{error}</p>}
          {output && (
            <>
              <p className="text-sm text-gray-200">{output.summary}</p>
              {output.recommendations.map((r, i) => (
                <div key={i} className="rounded-lg border border-border bg-surface-2 p-3 space-y-1.5">
                  <p className="text-sm text-gray-100">{r.recommendation}</p>
                  {r.reasoning && <p className="text-xs text-empire-muted">{r.reasoning}</p>}
                  <div className="flex gap-2">
                    <Badge variant="blue">conf {Math.round(r.confidence * 100)}%</Badge>
                    <Badge variant={r.riskLevel === 'high' ? 'red' : r.riskLevel === 'medium' ? 'yellow' : 'green'}>
                      risk {r.riskLevel}
                    </Badge>
                  </div>
                </div>
              ))}
              {drafts.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-empire-muted mb-2">
                    Drafted actions — approve to add to your Spine
                  </div>
                  <div className="space-y-2">
                    {drafts.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-gray-100 truncate">{d.title}</div>
                          <div className="text-[10px] font-mono text-empire-muted">
                            {d.category} · {d.priority}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" variant="primary" onClick={() => decideDraft(d.id, false)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => decideDraft(d.id, true)}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
