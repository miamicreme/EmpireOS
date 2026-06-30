'use client';

/**
 * Conversational surface for the Empire OS AI. Unlike the single-shot Agent
 * console, this keeps a running thread: every turn is posted to the orchestra
 * (/api/ai/agent/run) on the same threadId, so the 5-specialist council + final
 * synthesizer reason with full conversation context. Replies type out
 * word-by-word for a live feel, and each answer can reveal the council vote
 * breakdown that produced it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { postJson } from '@/lib/http';

interface SpecialistVote {
  specialist: string;
  recommendation: string;
  confidence: number;
}

interface AgentOutput {
  threadId: string;
  intent: string;
  answer: string;
  reasoningSummary: string;
  confidence: number;
  riskLevel: string;
  risks: string[];
  specialistVotes: SpecialistVote[];
  providerSummary: { providersUsed: string[]; latencyMs?: number };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  // Assistant-only metadata from the orchestra.
  meta?: Omit<AgentOutput, 'answer' | 'threadId'>;
  // Whether the assistant text is still revealing word-by-word.
  streaming?: boolean;
}

const SUGGESTIONS = [
  'What should I focus on this week?',
  'Help me think through a tough decision.',
  'What am I overlooking right now?',
  'Give me a plan to raise cash fast.',
];

function confidenceTone(n: number): 'green' | 'yellow' | 'red' {
  if (n >= 0.66) return 'green';
  if (n >= 0.4) return 'yellow';
  return 'red';
}

let idSeq = 0;
const nextId = () => `m${++idSeq}`;

export function ChatConsole() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reveal an assistant message word-by-word for a live, streamed feel.
  const revealAnswer = useCallback((id: string, full: string) => {
    const words = full.split(/(\s+)/); // keep whitespace tokens
    let i = 0;
    const tick = () => {
      i += 1;
      const partial = words.slice(0, i).join('');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, text: partial, streaming: i < words.length } : m,
        ),
      );
      if (i < words.length) {
        window.setTimeout(tick, 18);
      }
    };
    tick();
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;
      setError(null);
      setInput('');

      const userMsg: ChatMessage = { id: nextId(), role: 'user', text };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      try {
        const data = await postJson<AgentOutput>('/api/ai/agent/run', {
          command: text,
          threadId,
        });
        setThreadId(data.threadId);
        const { answer, threadId: _t, ...meta } = data;
        const id = nextId();
        setMessages((prev) => [
          ...prev,
          { id, role: 'assistant', text: '', meta, streaming: true },
        ]);
        revealAnswer(id, answer || '…');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The agent could not respond.');
      } finally {
        setSending(false);
      }
    },
    [sending, threadId, revealAnswer],
  );

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] max-w-3xl mx-auto">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
        {empty && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-empire-blue/15 text-empire-blue text-2xl shadow-glow">
              ✦
            </div>
            <div>
              <p className="text-sm font-medium text-gray-100">Talk to your Chief of Staff</p>
              <p className="text-xs text-empire-muted mt-1 max-w-sm">
                A council of five specialists plus a final judge reason over your Empire before
                answering. Ask anything.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs text-gray-300 border border-border rounded-full px-3 py-1.5 hover:border-empire-blue/50 hover:text-gray-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-empire-blue/15 border border-empire-blue/20 px-4 py-2.5 text-sm text-gray-100 whitespace-pre-wrap">
                {m.text}
              </div>
            </div>
          ) : (
            <AssistantBubble key={m.id} message={m} />
          ),
        )}

        {sending && <ThinkingRow />}
        {error && (
          <p className="text-xs text-empire-red font-mono text-center">{error}</p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-border pt-3 px-1"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Message your Chief of Staff…   (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none max-h-40 rounded-xl bg-surface-2 border border-border px-3.5 py-2.5 text-sm text-gray-100 placeholder:text-empire-muted/70 outline-none focus:border-empire-blue"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="h-10 w-10 shrink-0 rounded-xl bg-empire-blue text-surface-0 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-empire-blue/90 transition-colors active:scale-95"
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  const [showCouncil, setShowCouncil] = useState(false);
  const meta = message.meta;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-surface-1 border border-border px-4 py-3 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
        {message.text}
        {message.streaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-empire-blue/70 animate-pulse-dot" />
        )}
      </div>

      {meta && !message.streaming && (
        <div className="flex flex-wrap items-center gap-2 pl-1 text-[11px] text-empire-muted">
          <Badge variant={confidenceTone(meta.confidence)}>
            {Math.round(meta.confidence * 100)}% confident
          </Badge>
          {meta.providerSummary?.providersUsed?.length > 0 && (
            <span className="font-mono">
              {meta.providerSummary.providersUsed.join(' · ')}
            </span>
          )}
          {meta.specialistVotes?.length > 0 && (
            <button
              onClick={() => setShowCouncil((v) => !v)}
              className="hover:text-gray-300 transition-colors underline-offset-2 hover:underline"
            >
              {showCouncil ? 'Hide council' : `Council of ${meta.specialistVotes.length}`}
            </button>
          )}
        </div>
      )}

      {meta && showCouncil && (
        <div className="w-full max-w-[90%] rounded-xl border border-border bg-surface-0 p-3 space-y-2">
          {meta.reasoningSummary && (
            <p className="text-xs text-empire-muted leading-relaxed">{meta.reasoningSummary}</p>
          )}
          {meta.specialistVotes.map((v, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-gray-300">{v.specialist}</span>
                <Badge variant={confidenceTone(v.confidence)}>{Math.round(v.confidence * 100)}%</Badge>
              </div>
              <p className="text-empire-muted mt-0.5 leading-relaxed">{v.recommendation}</p>
            </div>
          ))}
          {meta.risks?.length > 0 && (
            <div className="pt-1">
              <p className="text-[11px] font-mono text-empire-red mb-1">Risks</p>
              <ul className="list-disc list-inside text-xs text-empire-muted space-y-0.5">
                {meta.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="flex items-center gap-2 pl-1 text-xs text-empire-muted">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-empire-blue animate-pulse-dot" />
        <span className="h-1.5 w-1.5 rounded-full bg-empire-blue animate-pulse-dot" style={{ animationDelay: '0.3s' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-empire-blue animate-pulse-dot" style={{ animationDelay: '0.6s' }} />
      </span>
      The council is deliberating…
    </div>
  );
}
