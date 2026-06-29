'use client';

/**
 * Dashboard AI widgets (client). One compact card that surfaces the AI Chief of
 * Staff: generate the daily plan, see the top recommendation + risk, review and
 * approve drafted actions, and ask a free-form question. Talks to the
 * /api/ai/* routes; provider keys never touch the client.
 */
import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { ChiefOfStaffOutput, SuggestedAction } from '@/spine/ai/ai.types';

interface Draft {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
}

interface CosResponse {
  output: ChiefOfStaffOutput;
  drafts: Draft[];
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

function riskTone(n: number): 'green' | 'yellow' | 'red' {
  return n >= 0.66 ? 'green' : n >= 0.4 ? 'yellow' : 'red';
}

export function AiChiefOfStaffWidget() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ChiefOfStaffOutput | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [question, setQuestion] = useState('');

  async function run(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<CosResponse>('/api/ai/chief-of-staff', q ? { question: q } : {});
      setOutput(data.output);
      setDrafts(data.drafts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run AI Chief of Staff');
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
    <Card hover>
      <CardHeader
        title="AI Chief of Staff"
        subtitle="Ask Empire OS"
        action={
          <Button size="sm" variant="primary" loading={loading} onClick={() => run()}>
            {output ? 'Refresh' : 'Run'}
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) run(question.trim());
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Should I focus on Uber or job applications today?"
            className="flex-1 h-9 px-3 rounded-lg bg-surface-2 border border-border text-sm text-gray-100 placeholder:text-empire-muted focus:outline-none focus:border-empire-blue"
          />
          <Button size="sm" variant="secondary" type="submit" loading={loading}>
            Ask
          </Button>
        </form>

        {error && (
          <p className="text-xs text-empire-red font-mono">{error}</p>
        )}

        {!output && !loading && (
          <p className="text-sm text-empire-muted font-mono">
            Run the Chief of Staff to get today&apos;s ranked plan, risks, and drafted actions.
          </p>
        )}

        {output && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-200">{output.executiveSummary}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={riskTone(output.confidence)}>
                  confidence {Math.round(output.confidence * 100)}%
                </Badge>
                {output.focusRecommendation && (
                  <span className="text-xs text-empire-blue font-mono truncate">
                    ▸ {output.focusRecommendation}
                  </span>
                )}
              </div>
            </div>

            {output.risks.length > 0 && (
              <div className="rounded-lg border border-empire-red/25 bg-empire-red/10 p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-empire-red mb-1">
                  Risk warnings
                </div>
                <ul className="text-xs text-gray-300 space-y-0.5 list-disc list-inside">
                  {output.risks.slice(0, 3).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <TopActions actions={output.topActions} />

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
          </div>
        )}
      </div>
    </Card>
  );
}

export function TopActions({ actions }: { actions: SuggestedAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-empire-muted mb-2">
        Top actions
      </div>
      <ol className="space-y-1.5">
        {actions.map((a, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="text-empire-blue font-mono">{i + 1}.</span>
            <div className="min-w-0">
              <span className="text-gray-100">{a.title}</span>
              {a.description && (
                <p className="text-xs text-empire-muted mt-0.5">{a.description}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
