'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input } from '@/components/ui/Field';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';

interface RecordingRow {
  id: string;
  title: string;
  status: string;
  duration_seconds: number | null;
  language: string | null;
  error: string | null;
  created_at: string;
}

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

const PROCESSABLE_STATUSES = new Set(['uploaded', 'transcribed', 'translated', 'failed']);

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function statusTone(status: string): 'green' | 'yellow' | 'red' | 'muted' {
  if (status === 'ready') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'uploaded') return 'muted';
  return 'yellow';
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export default function RecorderPage() {
  const { success, error } = useToast();
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<'idle' | 'recording' | 'paused' | 'uploading'>('idle');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<RecordingRow[]>('/api/recorder');
    if (res.ok) {
      setRecordings(res.data);
      setMicError(null);
    } else {
      // Check if this is a database initialization error
      if (res.error.message.includes('recordings')) {
        setMicError('Recorder isn\'t initialized yet. Database setup is incomplete. Please contact the administrator.');
      } else {
        error(res.error.message);
      }
    }
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const stopLevelMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = ((data[i] ?? 128) - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stopLevelMeter();
  }, [stopLevelMeter]);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  async function startRecording() {
    setMicError(null);
    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      setMicError('This browser does not support audio recording.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mimeTypeRef.current = mimeType;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;

      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      startLevelMeter(stream);
      setPhase('recording');
    } catch {
      setMicError('Microphone access was denied or is unavailable.');
    }
  }

  function pauseRecording() {
    mediaRecorderRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('paused');
  }

  function resumeRecording() {
    mediaRecorderRef.current?.resume();
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    setPhase('recording');
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = async () => {
      cleanupStream();
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      chunksRef.current = [];
      await upload(blob);
    };
    recorder.stop();
  }

  async function upload(blob: Blob) {
    setPhase('uploading');
    const form = new FormData();
    const ext = mimeTypeRef.current.includes('mp4') ? 'm4a' : mimeTypeRef.current.includes('ogg') ? 'ogg' : 'webm';
    form.append('audio', blob, `recording.${ext}`);
    form.append('title', title.trim() || `Recording — ${new Date().toLocaleString()}`);
    form.append('durationSeconds', String(elapsed));
    form.append('consentConfirmed', 'true');

    try {
      const res = await fetch('/api/recorder/upload', { method: 'POST', body: form });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; data: RecordingRow }
        | { ok: false; error: { message: string } }
        | null;

      if (!json || !json.ok) {
        error(json?.ok === false ? json.error.message : 'Upload failed.');
        setPhase('idle');
        return;
      }

      success('Recording saved. Click Process when you are ready to send it to AI.');
      setTitle('');
      setElapsed(0);
      setPhase('idle');
      setConsentChecked(false);
      void load();
    } catch {
      error('Upload failed — check your connection.');
      setPhase('idle');
    }
  }

  async function processRecording(id: string) {
    setProcessingId(id);
    const res = await api.post(`/api/recorder/${id}/process`, {});
    setProcessingId(null);
    if (res.ok) success('Recording processed');
    else error(res.error.message);
    void load();
  }

  async function remove(id: string) {
    const res = await api.del(`/api/recorder/${id}`);
    if (res.ok) {
      success('Recording deleted');
      void load();
    } else {
      error(res.error.message);
    }
  }

  const canRecord = consentChecked && (phase === 'idle');

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Empire Recorder"
        subtitle="Record interviews and conversations, save privately, then explicitly process them into transcripts, notes, and action drafts."
      />

      {micError && (
        <div className="rounded-lg border border-empire-red/50 bg-empire-red/5 px-4 py-3 mb-6 max-w-2xl">
          <p className="text-sm text-empire-red font-medium mb-2">Recorder isn't initialized</p>
          <p className="text-xs text-empire-red/90">{micError}</p>
        </div>
      )}

      <div className="space-y-6 max-w-2xl">
        {!micError && (
        <Card className="p-5 sm:p-6">
          <div className="rounded-lg border border-empire-yellow/25 bg-empire-yellow/10 px-4 py-3 mb-5">
            <label className="flex items-start gap-3 text-sm text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                disabled={phase !== 'idle'}
                className="mt-0.5 h-4 w-4 accent-empire-yellow"
              />
              <span>
                <span className="font-medium text-empire-yellow">Consent required.</span>{' '}
                Only record conversations when legally allowed and with proper consent from everyone
                on the call.
              </span>
            </label>
          </div>

          {(phase === 'idle') && (
            <div className="mb-4">
              <Field label="Title (optional)">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Interview with…" />
              </Field>
            </div>
          )}

          <div className="flex flex-col items-center gap-4 py-4">
            <div
              className={cn(
                'flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-2 transition-all',
                phase === 'recording' ? 'border-empire-red' : 'border-border-strong',
              )}
              style={
                phase === 'recording'
                  ? { boxShadow: `0 0 0 ${4 + level * 14}px rgba(248,113,113,${0.08 + level * 0.12})` }
                  : undefined
              }
            >
              <button
                type="button"
                onClick={phase === 'idle' ? startRecording : stopRecording}
                disabled={!canRecord && phase === 'idle'}
                aria-label={phase === 'idle' ? 'Start recording' : 'Stop recording'}
                className={cn(
                  'flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                  phase === 'idle' ? 'bg-empire-red hover:bg-empire-red/90' : 'bg-empire-red',
                )}
              >
                <span
                  className={cn(
                    'bg-white',
                    phase === 'idle' ? 'h-7 w-7 rounded-full' : 'h-6 w-6 rounded-sm',
                  )}
                />
              </button>
            </div>

            <div className="text-3xl font-mono nums text-gray-100 tabular-nums">{formatTimer(elapsed)}</div>

            {(phase === 'recording' || phase === 'paused') && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={phase === 'recording' ? pauseRecording : resumeRecording}>
                  {phase === 'recording' ? 'Pause' : 'Resume'}
                </Button>
                <Button variant="danger" onClick={stopRecording}>
                  Stop &amp; Save
                </Button>
              </div>
            )}

            {phase === 'uploading' && <p className="text-sm text-empire-muted font-mono">Saving recording…</p>}
            {phase === 'idle' && !consentChecked && (
              <p className="text-xs text-empire-muted">Check the consent box above to enable recording.</p>
            )}
            {micError && <p className="text-xs text-empire-red">{micError}</p>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recordings" subtitle={`${recordings.length} saved`} />
          <div className="p-2">
            {loading ? (
              <SkeletonRows rows={3} />
            ) : recordings.length === 0 ? (
              <EmptyState message="No recordings yet — record your first conversation above." />
            ) : (
              <div className="divide-y divide-border">
                {recordings.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-3">
                    <Link href={`/recorder/${r.id}` as Route} className="min-w-0 flex-1 group">
                      <p className="text-sm text-gray-100 truncate group-hover:text-empire-blue transition-colors">{r.title}</p>
                      <p className="mt-0.5 text-xs text-empire-muted font-mono">
                        {new Date(r.created_at).toLocaleString()}
                        {r.duration_seconds ? ` · ${formatTimer(Math.round(r.duration_seconds))}` : ''}
                        {r.language ? ` · ${r.language}` : ''}
                      </p>
                    </Link>
                    <Badge variant={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                    {PROCESSABLE_STATUSES.has(r.status) && (
                      <Button size="sm" variant="subtle" loading={processingId === r.id} onClick={() => processRecording(r.id)}>
                        Process
                      </Button>
                    )}
                    <button
                      className="text-empire-muted hover:text-empire-red text-xs shrink-0"
                      onClick={() => remove(r.id)}
                      aria-label="Delete recording"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        )}
      </div>
    </main>
  );
}
