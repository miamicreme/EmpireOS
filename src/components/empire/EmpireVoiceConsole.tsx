'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

type EmpireRunResult = {
  runId: string;
  traceId: string;
  status: 'completed' | 'needs_input' | 'awaiting_approval' | 'failed';
  intent: 'daily_context' | 'transcribe_recording' | 'approve_action_draft' | 'general_conversation' | 'unsupported';
  message: string;
  nextBestQuestion?: string;
  data?: {
    runtimePath?: string;
    specialistAgents?: string[];
    conductor?: {
      provider: string;
      model: string;
      decision: {
        responseMode: 'direct' | 'delegated';
        decisionSummary: string;
        delegatedTasks: Array<{ agent: string; task: string; reason: string }>;
      };
    };
  };
};

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};
type SpeechRecognitionErrorEventLike = Event & { error?: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function EmpireVoiceConsole() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const conversationIdRef = useRef<string>('');
  const continuousRef = useRef(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [continuous, setContinuous] = useState(false);
  const [supported, setSupported] = useState(false);
  const [orchestration, setOrchestration] = useState<EmpireRunResult['data'] | null>(null);

  useEffect(() => {
    setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    conversationIdRef.current = window.crypto?.randomUUID?.() ?? '';
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setState('idle');
  }

  function startListening() {
    if (!supported || recognitionRef.current || state === 'processing' || state === 'speaking') return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    setError('');
    setTranscript('');
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let text = '';
      for (let index = 0; index < event.results.length; index += 1) text += event.results[index]?.[0]?.transcript ?? '';
      setTranscript(text.trim());
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setError(event.error === 'not-allowed'
        ? 'Microphone permission was denied. Enable microphone access in your browser settings.'
        : `Voice recognition stopped${event.error ? `: ${event.error}` : '.'}`);
      setState('error');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setState((current) => (current === 'listening' ? 'idle' : current));
    };
    recognition.start();
    setState('listening');
  }

  function speak(text: string) {
    if (!text || !autoSpeak || !('speechSynthesis' in window)) {
      setState('idle');
      if (continuousRef.current) window.setTimeout(startListening, 250);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 0.95;
    utterance.onstart = () => setState('speaking');
    utterance.onend = () => {
      setState('idle');
      if (continuousRef.current) window.setTimeout(startListening, 350);
    };
    utterance.onerror = () => {
      setError('Empire generated a response, but the browser could not play it aloud.');
      setState('error');
    };
    window.speechSynthesis.speak(utterance);
  }

  async function sendToEmpire(message: string) {
    const cleaned = message.trim();
    if (!cleaned) return;
    setError('');
    setResponse('');
    setOrchestration(null);
    setState('processing');

    const result = await api.post<EmpireRunResult>('/api/empire/runs', {
      message: cleaned,
      conversationId: conversationIdRef.current || undefined,
    });
    if (!result.ok) {
      setError(result.error.message || 'Empire could not process the request.');
      setState('error');
      return;
    }

    const spokenText = result.data.nextBestQuestion
      ? `${result.data.message} ${result.data.nextBestQuestion}`
      : result.data.message;
    setResponse(spokenText);
    setOrchestration(result.data.data ?? null);
    speak(spokenText);
  }

  function stopListeningAndSend() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    void sendToEmpire(transcript);
  }

  function resetConversation() {
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    conversationIdRef.current = window.crypto?.randomUUID?.() ?? '';
    setTranscript('');
    setResponse('');
    setError('');
    setOrchestration(null);
    setState('idle');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-2xl border border-border bg-surface-1 p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-empire-blue">Empire Conductor</p>
            <h1 className="mt-2 text-2xl font-semibold text-gray-100">Talk to your operating system</h1>
            <p className="mt-2 max-w-xl text-sm text-gray-400">
              Empire decides whether to answer directly or delegate focused work to specialist agents, then gives you one coherent response.
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-mono text-gray-300">{state}</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {state !== 'listening' ? (
            <button type="button" onClick={startListening} disabled={!supported || state === 'processing' || state === 'speaking'} className="rounded-xl bg-empire-blue px-5 py-3 font-semibold text-black disabled:opacity-40">
              Start listening
            </button>
          ) : (
            <button type="button" onClick={stopListeningAndSend} className="rounded-xl bg-empire-blue px-5 py-3 font-semibold text-black">Stop and send</button>
          )}
          {state === 'speaking' && <button type="button" onClick={stopSpeaking} className="rounded-xl border border-border bg-surface-2 px-5 py-3 text-gray-100">Stop speaking</button>}
          <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-gray-300">
            <input type="checkbox" checked={continuous} onChange={(event) => setContinuous(event.target.checked)} />
            Continuous conversation
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-gray-300">
            <input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />
            Speak responses
          </label>
        </div>
        {!supported && <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Speech recognition is unavailable in this browser. Type below; Empire can still answer aloud.</p>}
      </section>

      <section className="rounded-2xl border border-border bg-surface-1 p-6 shadow-card">
        <label className="text-xs font-mono uppercase tracking-[0.2em] text-empire-muted">Your request</label>
        <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Ask Empire to compare options, make a plan, or coordinate specialist analysis…" className="mt-3 min-h-32 w-full rounded-xl border border-border bg-surface-2 p-4 text-gray-100 outline-none focus:border-empire-blue" />
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => void sendToEmpire(transcript)} disabled={!transcript.trim() || state === 'processing'} className="rounded-xl border border-empire-blue/40 bg-empire-blue/10 px-5 py-3 text-empire-blue disabled:opacity-40">
            {state === 'processing' ? 'Empire is coordinating…' : 'Send to Empire'}
          </button>
          <button type="button" onClick={resetConversation} className="rounded-xl border border-border px-5 py-3 text-gray-400">New conversation</button>
        </div>
      </section>

      {(response || error) && (
        <section className="rounded-2xl border border-border bg-surface-1 p-6 shadow-card" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-empire-muted">Empire</p>
            {orchestration?.conductor && (
              <span className="text-[11px] font-mono text-empire-muted">
                {orchestration.conductor.decision.responseMode === 'delegated'
                  ? `${orchestration.specialistAgents?.length ?? 0} specialist agent(s)`
                  : 'direct response'}
              </span>
            )}
          </div>
          {response && <p className="mt-3 text-lg leading-8 text-gray-100">{response}</p>}
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          {orchestration?.conductor?.decision.delegatedTasks?.length ? (
            <details className="mt-4 rounded-xl border border-border bg-surface-2 p-3 text-sm text-gray-300">
              <summary className="cursor-pointer text-xs font-mono uppercase tracking-wider text-empire-muted">Agent work</summary>
              <div className="mt-3 space-y-2">
                {orchestration.conductor.decision.delegatedTasks.map((task, index) => (
                  <div key={`${task.agent}-${index}`}><strong>{task.agent.replaceAll('_', ' ')}</strong>: {task.task}</div>
                ))}
              </div>
            </details>
          ) : null}
          {response && state !== 'speaking' && <button type="button" onClick={() => speak(response)} className="mt-4 rounded-xl border border-border px-4 py-2 text-sm text-gray-300">Speak again</button>}
        </section>
      )}
    </div>
  );
}
