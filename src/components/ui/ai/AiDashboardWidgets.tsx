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
import { postJson } from '@/lib/http';
import type { ChiefOfStaffOutput, SuggestedAction } from '@/spine/ai/ai.types';

interface Draft {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
}

interface DerivedFacts {
  cashTargetToday: number | null;
  cashCollectedToday: number | null;
  cashGapToday: number | null;
  overdueActionCount: number;
  completedTodayCount: number;
  openActionCount: number;
}

interface Trend {
  label: string;
  direction: 'up' | 'down' | 'flat';
  delta: number | null;
  streakDays: number;
}

interface CosResponse {
  output: ChiefOfStaffOutput;
  drafts: Draft[];
  derived?: DerivedFacts;
  trends?: Trend[];
}

function riskTone(n: number): 'green' | 'yellow' | 'red' {
  return n >= 0.66 ? 'green' : n >= 0.4 ? 'yellow' : 'red';
}

export function AiChiefOfStaffWidget() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ChiefOfStaffOutput | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [derived, setDerived] = useState<DerivedFacts | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [question, setQuestion] = useState('');

  async function run(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<CosResponse>('/api/ai/chief-of-staff', q ? { question: q } : {});
      setOutput(data.output);
      setDrafts(data.drafts ?? []);
      setDerived(data.derived ?? null);
      setTrends(data.trends ?? []);
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

            {derived && <DerivedStrip derived={derived} trends={trends} />}

            {output.risks.length > 0 && (
              <div className="rounded-[14px] border border-empire-red/25 bg-empire-red/10 p-3">
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
                      className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-surface-2 p-2.5"
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

function DerivedStrip({ derived, trends }: { derived: DerivedFacts; trends: Trend[] }) {
  const cash =
    derived.cashCollectedToday != null && derived.cashTargetToday != null
      ? `$${derived.cashCollectedToday}/${derived.cashTargetToday}`
      : '—';
  const cells: Array<{ label: string; value: string; tone?: string }> = [
    {
      label: 'cash',
      value: cash,
      tone: derived.cashGapToday && derived.cashGapToday > 0 ? 'text-empire-yellow' : 'text-empire-green',
    },
    {
      label: 'overdue',
      value: String(derived.overdueActionCount),
      tone: derived.overdueActionCount > 0 ? 'text-empire-red' : 'text-gray-300',
    },
    { label: 'done today', value: String(derived.completedTodayCount), tone: 'text-empire-green' },
    { label: 'open', value: String(derived.openActionCount), tone: 'text-gray-300' },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="rounded-[14px] border border-border bg-surface-2 px-2 py-1.5 text-center">
            <div className={`text-sm font-mono ${c.tone ?? 'text-gray-100'}`}>{c.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-empire-muted">{c.label}</div>
          </div>
        ))}
      </div>
      {trends.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {trends.map((t, i) => (
            <span
              key={i}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                t.direction === 'down'
                  ? 'border-empire-red/25 text-empire-red'
                  : 'border-empire-green/25 text-empire-green'
              }`}
            >
              {t.direction === 'down' ? '↓' : '↑'} {t.label} {t.streakDays}d
            </span>
          ))}
        </div>
      )}
    </div>
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
