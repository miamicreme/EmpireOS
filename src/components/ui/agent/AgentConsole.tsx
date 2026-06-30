'use client';

/**
 * No-friction agent command surface. One command bar + quick actions; the agent
 * routes everything (no provider/model/mode pickers). Shows the answer, why,
 * risks, sources, and approval-gated action drafts with one-tap controls.
 */
import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { postJson } from '@/lib/http';

interface ActionDraft {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  reason: string | null;
  approvalStatus: string;
}

interface AgentOutput {
  runId: string;
  threadId: string;
  runtimePath: string;
  status: string;
  intent: string;
  answer: string;
  reasoningSummary: string;
  confidence: number;
  riskLevel: string;
  risks: string[];
  opportunities: string[];
  nextActions: Array<{ title: string; priority: string; reason: string }>;
  actionDrafts: ActionDraft[];
  memoryRequests: Array<{ question: string; reason: string }>;
  researchRequests: Array<{ topic: string; reason: string; userActionRequired: string }>;
  specialistVotes: Array<{ specialist: string; recommendation: string; confidence: number }>;
  providerSummary: { providersUsed: string[]; latencyMs?: number };
}

const QUICK_ACTIONS = [
  'What should I do today?',
  'Find cash fastest.',
  'Draft my next 5 actions.',
  'What am I ignoring?',
  'Analyze this funding move.',
  'Run deep strategy.',
];

function confidenceTone(n: number): 'green' | 'yellow' | 'red' {
  return n >= 0.66 ? 'green' : n >= 0.4 ? 'yellow' : 'red';
}

export function AgentConsole() {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<AgentOutput | null>(null);
  const [drafts, setDrafts] = useState<ActionDraft[]>([]);
  const [showWhy, setShowWhy] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  // The actual command last submitted — so "Go deeper"/"Use research" re-run the
  // original question even after the input box is cleared (never the answer text).
  const [lastCommand, setLastCommand] = useState('');

  async function run(cmd: string, opts: { goDeeper?: boolean; useResearch?: boolean } = {}) {
    if (!cmd.trim()) return;
    setLastCommand(cmd.trim());
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<AgentOutput>('/api/ai/agent/run', {
        command: cmd.trim(),
        threadId,
        goDeeper: opts.goDeeper,
        useResearch: opts.useResearch,
      });
      setOutput(data);
      setDrafts(data.actionDrafts ?? []);
      setThreadId(data.threadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agent run failed');
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, action: 'approve' | 'reject') {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    try {
      await postJson(`/api/ai/agent/action-drafts/${id}/approve`, { action });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update draft');
    }
  }

  async function approveAll() {
    const ids = drafts.map((d) => d.id);
    setDrafts([]);
    try {
      await postJson('/api/ai/agent/action-drafts', { ids });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve drafts');
    }
  }

  async function saveMemory() {
    if (!output) return;
    try {
      await postJson('/api/ai/agent/memory', {
        memoryType: 'decision_pattern',
        content: output.answer,
        summary: output.reasoningSummary,
        source: 'agent_answer',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save memory');
    }
  }

  return (
    <Card hover>
      <CardHeader
        title="Empire OS Agent"
        subtitle={output ? `${output.runtimePath} · ${output.intent}` : 'Type a short command'}
      />
      <div className="p-4 space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(command);
          }}
        >
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="What today?  ·  Find cash fastest.  ·  Analyze this deal."
            className="flex-1 h-9 px-3 rounded-lg bg-surface-2 border border-border text-sm text-gray-100 placeholder:text-empire-muted focus:outline-none focus:border-empire-blue"
          />
          <Button size="sm" variant="primary" type="submit" loading={loading}>
            Run
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setCommand(q);
                run(q);
              }}
              className="text-[11px] font-mono px-2 py-1 rounded border border-border text-empire-muted hover:text-gray-100 hover:border-empire-muted/40 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-empire-red font-mono">{error}</p>}
        {!output && !loading && (
          <p className="text-sm text-empire-muted font-mono">
            One command in. The agent reads your Spine, reasons, and drafts actions for approval.
          </p>
        )}

        {output && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{output.answer}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={confidenceTone(output.confidence)}>
                  confidence {Math.round(output.confidence * 100)}%
                </Badge>
                <Badge variant={output.riskLevel === 'high' ? 'red' : output.riskLevel === 'medium' ? 'yellow' : 'green'}>
                  risk {output.riskLevel}
                </Badge>
                {output.providerSummary.latencyMs != null && (
                  <span className="text-[10px] font-mono text-empire-muted">
                    {output.providerSummary.latencyMs}ms
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => run(lastCommand, { goDeeper: true })}>
                Go deeper
              </Button>
              <Button size="sm" variant="secondary" onClick={() => run(lastCommand, { useResearch: true })}>
                Use research
              </Button>
              <Button size="sm" variant="ghost" onClick={saveMemory}>
                Save memory
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowWhy((s) => !s)}>
                {showWhy ? 'Hide why' : 'Show why'}
              </Button>
            </div>

            {showWhy && output.reasoningSummary && (
              <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-gray-300">
                {output.reasoningSummary}
                {output.specialistVotes.length > 0 && (
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {output.specialistVotes.map((v, i) => (
                      <li key={i}>
                        <span className="text-empire-blue">{v.specialist}</span>: {v.recommendation}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {output.risks.length > 0 && (
              <ListBlock title="Risk warnings" tone="red" items={output.risks} />
            )}

            {output.researchRequests.length > 0 && (
              <div className="rounded-lg border border-empire-yellow/25 bg-empire-yellow/10 p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-empire-yellow mb-1">
                  Research needed
                </div>
                {output.researchRequests.map((r, i) => (
                  <p key={i} className="text-xs text-gray-300">
                    {r.topic} — {r.userActionRequired}
                  </p>
                ))}
              </div>
            )}

            {output.memoryRequests.length > 0 && (
              <ListBlock title="To sharpen future answers" tone="muted" items={output.memoryRequests.map((m) => m.question)} />
            )}

            {drafts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-empire-muted">
                    Drafted actions — approve to add to your Spine
                  </span>
                  <Button size="sm" variant="primary" onClick={approveAll}>
                    Approve all
                  </Button>
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
                          {d.reason ? ` · ${d.reason}` : ''}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="primary" onClick={() => decide(d.id, 'approve')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => decide(d.id, 'reject')}>
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

function ListBlock({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'red' | 'muted';
  items: string[];
}) {
  const border = tone === 'red' ? 'border-empire-red/25 bg-empire-red/10' : 'border-border bg-surface-2';
  const label = tone === 'red' ? 'text-empire-red' : 'text-empire-muted';
  return (
    <div className={`rounded-lg border ${border} p-3`}>
      <div className={`text-[10px] font-mono uppercase tracking-widest ${label} mb-1`}>{title}</div>
      <ul className="text-xs text-gray-300 space-y-0.5 list-disc list-inside">
        {items.slice(0, 5).map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
