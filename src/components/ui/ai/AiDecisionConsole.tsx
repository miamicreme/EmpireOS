'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TopActions } from '@/components/ui/ai/AiDashboardWidgets';
import { postJson } from '@/lib/http';
import type { ChiefOfStaffOutput } from '@/spine/ai/ai.types';

interface Draft {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
}

const EXAMPLES = [
  'Should I focus on Uber today or job applications?',
  'What is the fastest path to cash this week?',
  'Should this project be paused?',
  'Should I push this recruiter?',
];


export function AiDecisionConsole() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ChiefOfStaffOutput | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ output: ChiefOfStaffOutput; drafts: Draft[] }>(
        '/api/ai/chief-of-staff',
        { question: q.trim() },
      );
      setOutput(data.output);
      setDrafts(data.drafts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze');
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
    <div className="space-y-4">
      <Card>
        <CardHeader title="Decision Console" subtitle="Ask a decision; get a recommendation + actions" />
        <div className="p-4 space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a decision…"
              className="flex-1 h-9 px-3 rounded-lg bg-surface-2 border border-border text-sm text-gray-100 placeholder:text-empire-muted focus:outline-none focus:border-empire-blue"
            />
            <Button size="sm" variant="primary" type="submit" loading={loading}>
              Analyze
            </Button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuestion(ex);
                  ask(ex);
                }}
                className="text-[11px] font-mono px-2 py-1 rounded border border-border text-empire-muted hover:text-gray-100 hover:border-empire-muted/40 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-empire-red font-mono">{error}</p>}
        </div>
      </Card>

      {output && (
        <Card>
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-200">{output.executiveSummary}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="blue">confidence {Math.round(output.confidence * 100)}%</Badge>
              {output.focusRecommendation && (
                <Badge variant="green">focus: {output.focusRecommendation}</Badge>
              )}
            </div>
            {output.reasoning && <p className="text-xs text-empire-muted">{output.reasoning}</p>}
            <TopActions actions={output.topActions} />
            {drafts.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-empire-muted mb-2">
                  Create actions — approve to add to your Spine
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
                          Create
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => decideDraft(d.id, true)}>
                          Skip
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
