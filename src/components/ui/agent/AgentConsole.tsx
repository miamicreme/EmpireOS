'use client';

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

interface IssueBreakdownItem {
  topic: string;
  insight: string;
  tension: string;
  practicalMove: string;
}

interface LeverageMapItem {
  lever: string;
  whyItMatters: string;
  firstProof: string;
}

interface DecisionPathStep {
  step: string;
  reason: string;
  doneWhen: string;
}

interface AgentOutput {
  runId: string;
  threadId: string;
  runtimePath: string;
  status: string;
  intent: string;
  answer: string;
  empireBrief?: string;
  operatingMode?: string;
  realIssue?: string;
  mentorNote?: string;
  issueBreakdown?: IssueBreakdownItem[];
  leverageMap?: LeverageMapItem[];
  blindSpots?: string[];
  antiPatterns?: string[];
  decisionPath?: DecisionPathStep[];
  creativeAngles?: string[];
  conversationStarters?: string[];
  nextBestQuestion?: string;
  reasoningSummary: string;
  confidence: number;
  riskLevel: string;
  risks: string[];
  nextActions: Array<{ title: string; priority: string; reason: string }>;
  actionDrafts: ActionDraft[];
  memoryRequests: Array<{ question: string; reason: string }>;
  researchRequests: Array<{ topic: string; reason: string; userActionRequired: string }>;
  providerSummary: { providersUsed: string[]; latencyMs?: number };
}

const QUICK_ACTIONS = [
  'Empire read: what is happening, what matters, and what should I do next?',
  'What is the real issue underneath this?',
  'Find the leverage point and first proof.',
  'Show me the blind spots and anti-patterns.',
  'Break this into a decision path.',
  'Give me a creative angle with validation.',
  'Diagnose the bottleneck before giving actions.',
  'Run deep strategy with Empire-level judgment.',
];

function confidenceTone(value: number): 'green' | 'yellow' | 'red' {
  return value >= 0.66 ? 'green' : value >= 0.4 ? 'yellow' : 'red';
}

export function AgentConsole() {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<AgentOutput | null>(null);
  const [drafts, setDrafts] = useState<ActionDraft[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState('');
  const [showDetails, setShowDetails] = useState(false);

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Empire run failed');
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, action: 'approve' | 'reject') {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
    try {
      await postJson(`/api/ai/agent/action-drafts/${id}/approve`, { action });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update draft');
    }
  }

  async function approveAll() {
    const ids = drafts.map((draft) => draft.id);
    setDrafts([]);
    try {
      await postJson('/api/ai/agent/action-drafts', { ids });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to approve drafts');
    }
  }

  const leverage = output?.leverageMap?.filter((item) => item.lever || item.whyItMatters) ?? [];
  const decisions = output?.decisionPath?.filter((item) => item.step || item.reason) ?? [];
  const blindSpots = output?.blindSpots?.filter(Boolean) ?? [];

  return (
    <Card hover>
      <CardHeader
        title="Empire"
        subtitle={
          output
            ? `${output.operatingMode ?? output.runtimePath} · ${output.intent}`
            : 'Real intelligence connected to the Spine, modules, approvals, and verified execution'
        }
      />

      <div className="p-4 space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(command);
          }}
        >
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Talk to Empire. Ask for the real issue, leverage, proof, or action."
            className="flex-1 h-10 px-3 rounded-lg bg-surface-2 border border-border text-sm text-gray-100 placeholder:text-empire-muted focus:outline-none focus:border-empire-blue"
          />
          <Button size="sm" variant="primary" type="submit" loading={loading}>
            Run
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCommand(item);
                void run(item);
              }}
              className="text-[11px] font-mono px-2 py-1 rounded border border-border text-empire-muted hover:text-gray-100 hover:border-empire-muted/40 transition-colors"
            >
              {item}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-empire-red font-mono">{error}</p>}

        {!output && !loading && (
          <p className="text-sm text-empire-muted">
            Empire reads the situation, identifies the real issue, narrows the field, and only claims execution when the backend produces proof.
          </p>
        )}

        {output && (
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
              {output.empireBrief && (
                <div className="rounded-lg border border-empire-blue/20 bg-empire-blue/10 p-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-empire-blue mb-1">
                    Empire brief
                  </div>
                  <p className="text-sm text-gray-100 leading-relaxed">{output.empireBrief}</p>
                </div>
              )}

              {output.realIssue && (
                <p className="text-sm text-gray-300 leading-relaxed">
                  <span className="text-empire-blue font-mono text-xs uppercase tracking-widest">
                    Real issue:{' '}
                  </span>
                  {output.realIssue}
                </p>
              )}

              <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">
                {output.answer}
              </p>

              {output.mentorNote && (
                <p className="text-sm text-empire-muted leading-relaxed border-l-2 border-empire-blue/50 pl-3">
                  {output.mentorNote}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={confidenceTone(output.confidence)}>
                  confidence {Math.round(output.confidence * 100)}%
                </Badge>
                <Badge
                  variant={
                    output.riskLevel === 'high'
                      ? 'red'
                      : output.riskLevel === 'medium'
                        ? 'yellow'
                        : 'green'
                  }
                >
                  risk {output.riskLevel}
                </Badge>
                {output.providerSummary.latencyMs != null && (
                  <span className="text-[10px] font-mono text-empire-muted">
                    {output.providerSummary.latencyMs}ms
                  </span>
                )}
              </div>
            </section>

            {leverage.length > 0 && (
              <section className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-empire-green">
                  Leverage
                </div>
                {leverage.slice(0, 3).map((item, index) => (
                  <div key={index} className="rounded-lg border border-border bg-surface-2 p-3 space-y-1">
                    <div className="text-sm font-medium text-gray-100">{item.lever}</div>
                    {item.whyItMatters && <p className="text-xs text-gray-300">{item.whyItMatters}</p>}
                    {item.firstProof && (
                      <p className="text-xs text-empire-green">First proof: {item.firstProof}</p>
                    )}
                  </div>
                ))}
              </section>
            )}

            {decisions.length > 0 && (
              <section className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-empire-violet">
                  Decision path
                </div>
                {decisions.slice(0, 3).map((item, index) => (
                  <div key={index} className="rounded-lg border border-border bg-surface-2 p-3 space-y-1">
                    <div className="text-sm font-medium text-gray-100">
                      {index + 1}. {item.step}
                    </div>
                    {item.reason && <p className="text-xs text-gray-300">{item.reason}</p>}
                    {item.doneWhen && (
                      <p className="text-xs text-empire-muted">Done when: {item.doneWhen}</p>
                    )}
                  </div>
                ))}
              </section>
            )}

            {blindSpots.length > 0 && (
              <ListBlock title="Blind spots" items={blindSpots.slice(0, 5)} />
            )}

            {output.nextBestQuestion && (
              <ListBlock title="Next best question" items={[output.nextBestQuestion]} />
            )}

            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => void run(lastCommand, { goDeeper: true })}>
                Go deeper
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void run(lastCommand, { useResearch: true })}>
                Use research
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowDetails((current) => !current)}>
                {showDetails ? 'Hide details' : 'Show details'}
              </Button>
            </div>

            {showDetails && output.reasoningSummary && (
              <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-gray-300">
                {output.reasoningSummary}
              </div>
            )}

            {output.risks.length > 0 && (
              <div className="rounded-lg border border-empire-red/25 bg-empire-red/10 p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-empire-red mb-1">
                  Risk warnings
                </div>
                <ul className="text-xs text-gray-300 space-y-0.5 list-disc list-inside">
                  {output.risks.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            )}

            {drafts.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-empire-muted">
                    Drafted actions — approve to add to the Spine
                  </span>
                  <Button size="sm" variant="primary" onClick={() => void approveAll()}>
                    Approve all
                  </Button>
                </div>
                <div className="space-y-2">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-gray-100 truncate">{draft.title}</div>
                        <div className="text-[10px] font-mono text-empire-muted">
                          {draft.category} · {draft.priority}
                          {draft.reason ? ` · ${draft.reason}` : ''}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="primary" onClick={() => void decide(draft.id, 'approve')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void decide(draft.id, 'reject')}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-empire-muted mb-1">
        {title}
      </div>
      <ul className="text-xs text-gray-300 space-y-0.5 list-disc list-inside">
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </div>
  );
}
