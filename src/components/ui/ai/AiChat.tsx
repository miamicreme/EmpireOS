'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ChiefOfStaffOutput } from '@/spine/ai/ai.types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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

function formatReply(o: ChiefOfStaffOutput): string {
  const lines = [o.executiveSummary];
  if (o.focusRecommendation) lines.push(`\nFocus: ${o.focusRecommendation}`);
  if (o.topActions.length > 0) {
    lines.push('\nTop actions:');
    o.topActions.forEach((a, i) => lines.push(`${i + 1}. ${a.title}`));
  }
  if (o.risks.length > 0) lines.push(`\nRisks: ${o.risks.join('; ')}`);
  return lines.join('\n');
}

export function AiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setLoading(true);
    try {
      // persist:false — chat is exploratory; it shouldn't spam drafts/recs.
      const data = await postJson<{ output: ChiefOfStaffOutput }>('/api/ai/chief-of-staff', {
        question: q,
        persist: false,
      });
      setMessages((m) => [...m, { role: 'assistant', content: formatReply(data.output) }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Failed to respond' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-empire-muted font-mono">
              Ask Empire OS anything about your empire — cash, jobs, deals, priorities.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] rounded-lg bg-empire-blue/15 border border-empire-blue/25 px-3 py-2 text-sm text-gray-100'
                    : 'max-w-[80%] rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm text-gray-200 whitespace-pre-wrap'
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-empire-muted font-mono">thinking…</div>}
        </div>
        <form
          className="flex gap-2 p-3 border-t border-border"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Empire OS…"
            className="flex-1 h-9 px-3 rounded-lg bg-surface-2 border border-border text-sm text-gray-100 placeholder:text-empire-muted focus:outline-none focus:border-empire-blue"
          />
          <Button size="sm" variant="primary" type="submit" loading={loading}>
            Send
          </Button>
        </form>
      </div>
    </Card>
  );
}
