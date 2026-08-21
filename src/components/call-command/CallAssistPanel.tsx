'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { CALL_STAGES, type CallHistoryTurn, type CallStage } from '@/modules/call-command/types';

interface AssistResult {
  response: string;
  intent: string;
  confidence: number;
  next_action: string;
  escalate: boolean;
  provider: string;
}

const STAGE_LABELS: Record<CallStage, string> = {
  opening: 'Opening',
  discovery: 'Discovery',
  objection: 'Objection',
  closing: 'Closing',
  unknown: 'Unspecified',
};

export function CallAssistPanel() {
  const { error } = useToast();
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<CallStage>('unknown');
  const [history, setHistory] = useState<CallHistoryTurn[]>([]);
  const [lastIntent, setLastIntent] = useState<string | undefined>(undefined);
  const [lowConfidenceStreak, setLowConfidenceStreak] = useState(0);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [loading, setLoading] = useState(false);

  const busy = loading;

  async function submit() {
    if (!input.trim() || busy) return;
    setLoading(true);
    const response = await api.post<AssistResult>('/api/call-command/assist', {
      input: input.trim(),
      stage,
      intent: lastIntent,
      history,
      recentLowConfidenceCount: lowConfidenceStreak,
    });
    setLoading(false);

    if (!response.ok) {
      error(response.error.message);
      return;
    }

    const data = response.data;
    setResult(data);
    setLastIntent(data.intent);
    setLowConfidenceStreak(data.confidence < 0.5 ? lowConfidenceStreak + 1 : 0);
    setHistory((prev) =>
      [
        ...prev,
        { speaker: 'prospect' as const, text: input.trim() },
        { speaker: 'rep' as const, text: data.response },
      ].slice(-20),
    );
    setInput('');
  }

  function reset() {
    setHistory([]);
    setLastIntent(undefined);
    setLowConfidenceStreak(0);
    setResult(null);
    setInput('');
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-empire-blue">Live turn</p>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
              Reset call
            </Button>
          )}
        </div>

        <Field label="Call stage">
          <Select value={stage} onChange={(e) => setStage(e.target.value as CallStage)} disabled={busy}>
            {CALL_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="mt-4">
          <Field label="What the prospect just said" hint="Max 2 sentences back — this stays live, nothing is saved.">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. That sounds expensive for what it is…"
              rows={4}
              disabled={busy}
              maxLength={2000}
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submit} disabled={!input.trim() || busy} loading={loading}>
            Get suggestion
          </Button>
          {history.length > 0 && (
            <p className="text-xs text-empire-muted font-mono">{history.length} turn(s) this call</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Operator view" subtitle={result ? `via ${result.provider || 'stub'}` : undefined} />
        <div className="p-5 sm:p-6">
          {!result ? (
            <p className="text-sm text-empire-muted">No suggestion yet — enter what the prospect said and submit.</p>
          ) : (
            <div className="space-y-4">
              {result.escalate && (
                <div className="rounded-lg border border-empire-red/40 bg-empire-red/10 px-4 py-3">
                  <p className="text-sm font-semibold text-empire-red">Escalate to manager</p>
                  <p className="mt-1 text-xs text-empire-red/90">
                    Confidence has been low for multiple turns in a row — consider looping in a manager.
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-border bg-surface-0 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-empire-muted">Suggested response</p>
                <p className="mt-2 text-base leading-6 text-gray-100">{result.response}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-surface-0 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-empire-muted">Intent</p>
                  <p className="mt-1 text-sm text-gray-100">{result.intent}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-0 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-empire-muted">Confidence</p>
                  <p className="mt-1 text-sm text-gray-100">{Math.round(result.confidence * 100)}%</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-empire-muted">Next action</span>
                <Badge variant="blue">{result.next_action}</Badge>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
