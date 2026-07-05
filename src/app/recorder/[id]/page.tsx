'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusVariant } from '@/components/ui/Badge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';

interface RecordingDetail {
  id: string;
  title: string;
  status: string;
  duration_seconds: number | null;
  language: string | null;
  transcript: string | null;
  translated_transcript: string | null;
  summary: string | null;
  error: string | null;
  audioUrl: string | null;
  created_at: string;
  metadata: {
    analysis?: {
      summary: string;
      keyPoints: string[];
      decisions: string[];
      followUps: string[];
      questions: string[];
      names: string[];
      dates: string[];
      risks: string[];
    };
    draftIds?: string[];
  };
}

interface ActionDraft {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function statusTone(status: string): 'green' | 'yellow' | 'red' | 'muted' {
  if (status === 'ready') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'uploaded') return 'muted';
  return 'yellow';
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-empire-muted">{label}</div>
      <ul className="space-y-1 text-sm text-gray-200">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-empire-blue">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RecordingDetailPage() {
  const params = useParams<{ id: string }>();
  const { success, error } = useToast();
  const [recording, setRecording] = useState<RecordingDetail | null>(null);
  const [drafts, setDrafts] = useState<ActionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTranslated, setShowTranslated] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<RecordingDetail>(`/api/recorder/${params.id}`);
    if (res.ok) {
      setRecording(res.data);
      const draftIds = res.data.metadata?.draftIds ?? [];
      if (draftIds.length > 0) {
        const draftsRes = await api.get<ActionDraft[]>('/api/ai/action-drafts');
        if (draftsRes.ok) setDrafts(draftsRes.data.filter((d) => draftIds.includes(d.id)));
      }
    } else {
      error(res.error.message);
    }
    setLoading(false);
  }, [params.id, error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runStep(endpoint: string) {
    if (!recording) return;
    setBusy(true);
    const res = await api.post(endpoint, { id: recording.id });
    setBusy(false);
    if (res.ok) void load();
    else error(res.error.message);
  }

  async function decide(draftId: string, reject: boolean) {
    const res = await api.post(`/api/ai/action-drafts/${draftId}/approve`, { reject });
    if (res.ok) {
      success(reject ? 'Draft rejected' : 'Draft approved — added to Actions');
      void load();
    } else {
      error(res.error.message);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <SkeletonRows rows={6} />
      </main>
    );
  }

  if (!recording) {
    return (
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <EmptyState message="Recording not found." />
      </main>
    );
  }

  const analysis = recording.metadata?.analysis;
  const displayedTranscript =
    showTranslated && recording.translated_transcript ? recording.translated_transcript : recording.transcript;

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title={recording.title}
        subtitle={new Date(recording.created_at).toLocaleString()}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={statusTone(recording.status)}>{statusLabel(recording.status)}</Badge>
            <Link href={'/recorder' as Route}>
              <Button variant="ghost" size="sm">
                ← All recordings
              </Button>
            </Link>
          </div>
        }
      />

      <div className="space-y-5 max-w-3xl">
        {recording.error && (
          <Card className="border-empire-red/30 p-4">
            <p className="text-sm text-empire-red">{recording.error}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              loading={busy}
              onClick={() =>
                runStep(
                  recording.transcript ? (recording.translated_transcript ? '/api/recorder/analyze' : '/api/recorder/translate') : '/api/recorder/transcribe',
                )
              }
            >
              Retry
            </Button>
          </Card>
        )}

        {recording.audioUrl && (
          <Card className="p-4">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={recording.audioUrl} className="w-full" />
          </Card>
        )}

        {!recording.transcript && !recording.error && (
          <Card className="p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-empire-muted">Not transcribed yet.</p>
            <Button size="sm" loading={busy} onClick={() => runStep('/api/recorder/transcribe')}>
              Transcribe
            </Button>
          </Card>
        )}

        {recording.transcript && !recording.summary && !recording.error && (
          <Card className="p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-empire-muted">Transcribed — ready to analyze.</p>
            <Button size="sm" loading={busy} onClick={() => runStep('/api/recorder/analyze')}>
              Analyze
            </Button>
          </Card>
        )}

        {analysis && (
          <Card>
            <CardHeader title="Summary" subtitle={`Confidence-scored extraction · ${recording.language ?? 'unknown language'}`} />
            <div className="p-4 space-y-4">
              <p className="text-sm leading-relaxed text-gray-200">{analysis.summary}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <ListBlock label="Key points" items={analysis.keyPoints} />
                <ListBlock label="Decisions" items={analysis.decisions} />
                <ListBlock label="Follow-ups" items={analysis.followUps} />
                <ListBlock label="Open questions" items={analysis.questions} />
                <ListBlock label="Names" items={analysis.names} />
                <ListBlock label="Dates" items={analysis.dates} />
              </div>
              <ListBlock label="Risks" items={analysis.risks} />
            </div>
          </Card>
        )}

        {drafts.length > 0 && (
          <Card>
            <CardHeader title="Action drafts" subtitle={`${drafts.filter((d) => d.status === 'pending').length} pending approval`} />
            <div className="divide-y divide-border">
              {drafts.map((d) => (
                <div key={d.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-100">{d.title}</p>
                      <Badge variant={statusVariant(d.priority)}>{d.priority}</Badge>
                    </div>
                    {d.description && <p className="mt-1 text-xs text-empire-muted">{d.description}</p>}
                  </div>
                  {d.status === 'pending' ? (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => decide(d.id, true)}>
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => decide(d.id, false)}>
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <Badge variant={d.status === 'approved' ? 'green' : 'muted'}>{d.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {recording.transcript && (
          <Card>
            <CardHeader
              title="Transcript"
              subtitle={recording.language ?? undefined}
              action={
                recording.translated_transcript ? (
                  <Button size="sm" variant="ghost" onClick={() => setShowTranslated((v) => !v)}>
                    {showTranslated ? 'Show original' : 'Show translation'}
                  </Button>
                ) : undefined
              }
            />
            <div className="p-4">
              <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">{displayedTranscript}</p>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
