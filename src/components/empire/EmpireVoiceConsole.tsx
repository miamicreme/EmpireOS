'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

type EmpireRunResult = {
  runId: string;
  traceId: string;
  status: 'completed' | 'needs_input' | 'awaiting_approval' | 'failed';
  intent: 'daily_context' | 'transcribe_recording' | 'approve_action_draft' | 'unsupported';
  message: string;
  nextBestQuestion?: string;
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
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setState('idle');
  }

  function speak(text: string) {
    if (!text || !autoSpeak || !('speechSynthesis' in window)) {
      setState('idle');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 0.95;
    utterance.onstart = () => setState('speaking');
    utterance.onend = () => setState('idle');
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
    setState('processing');

    const result = await api.post<EmpireRunResult>('/api/empire/runs', { message: cleaned });
    if (!result.ok) {
      setError(result.error.message || 'Empire could not process the request.');
      setState('error');
      return;
    }

    const spokenText = result.data.nextBestQuestion
      ? `${result.data.message} ${result.data.nextBestQuestion}`
      : result.data.message;

    setResponse(spokenText);
    speak(spokenText);
  }

  function startListening() {
    if (!supported || state === 'processing' || state === 'speaking') return;

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
      for (let index = 0; index < event.results.length; index += 1) {
        text += event.results[index]?.[0]?.transcript ?? '';
      }
      setTranscript(text.trim());
    };

    recognition.onerror = (event) => {
      const message = event.error === 'not-allowed'
        ? 'Microphone permission was denied. Enable microphone access in your browser settings.'
        : `Voice recognition stopped${event.error ? `: ${event.error}` : '.'}`;
      setError(message);
      setState('error');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setState((current) => (current === 'listening' ? 'idle' : current));
    };

    recognition.start();
    setState('listening');
  }

  function stopListeningAndSend() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    void sendToEmpire(transcript);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-border bg-surface-1 p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-empire-blue">Empire Voice</p>
            <h1 className="mt-2 text-2xl font-semibold text-gray-100">Speak to Empire</h1>
            <p className="mt-2 max-w-xl text-sm text-gray-400">
              Tap the microphone, speak naturally, then send. Empire will answer aloud through your browser.
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-mono text-gray-300">
            {state}
          </span>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {state !== 'listening' ? (
            <button
              type="button"
              onClick={startListening}
              disabled={!supported || state === 'processing' || state === 'speaking'}
              className="rounded-xl bg-empire-blue px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start listening
            </button>
          ) : (
            <button
              type="button"
              onClick={stopListeningAndSend}
              className="rounded-xl bg-empire-blue px-5 py-3 font-semibold text-black"
            >
              Stop and send
            </button>
          )}

          {state === 'speaking' && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="rounded-xl border border-border bg-surface-2 px-5 py-3 text-gray-100"
            >
              Stop speaking
            </button>
          )}

          <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(event) => setAutoSpeak(event.target.checked)}
            />
            Speak responses
          </label>
        </div>

        {!supported && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            This browser does not expose speech recognition. Type a request below; Empire can still speak the response.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface-1 p-6 shadow-card">
        <label className="text-xs font-mono uppercase tracking-[0.2em] text-empire-muted">Your request</label>
        <textarea
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="What should I focus on today?"
          className="mt-3 min-h-32 w-full rounded-xl border border-border bg-surface-2 p-4 text-gray-100 outline-none focus:border-empire-blue"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void sendToEmpire(transcript)}
            disabled={!transcript.trim() || state === 'processing'}
            className="rounded-xl border border-empire-blue/40 bg-empire-blue/10 px-5 py-3 text-empire-blue disabled:opacity-40"
          >
            {state === 'processing' ? 'Empire is working…' : 'Send to Empire'}
          </button>
          <button
            type="button"
            onClick={() => {
              recognitionRef.current?.abort();
              window.speechSynthesis?.cancel();
              setTranscript('');
              setResponse('');
              setError('');
              setState('idle');
            }}
            className="rounded-xl border border-border px-5 py-3 text-gray-400"
          >
            Clear
          </button>
        </div>
      </section>

      {(response || error) && (
        <section className="rounded-2xl border border-border bg-surface-1 p-6 shadow-card" aria-live="polite">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-empire-muted">Empire</p>
          {response && <p className="mt-3 text-lg leading-8 text-gray-100">{response}</p>}
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          {response && state !== 'speaking' && (
            <button
              type="button"
              onClick={() => speak(response)}
              className="mt-4 rounded-xl border border-border px-4 py-2 text-sm text-gray-300"
            >
              Speak again
            </button>
          )}
        </section>
      )}
    </div>
  );
}
