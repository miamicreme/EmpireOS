'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';

type Mission = {
  id: string;
  title: string;
  objective: string;
  status: string;
  priority: string;
  autonomy_level: string;
  review_required: boolean;
  created_at: string;
};

type Detail = {
  mission: Mission;
  team: { id: string; name: string; purpose: string; default_autonomy_level: string } | null;
  tasks: Array<{ id: string; title: string; description: string | null; status: string; review_notes: string | null }>;
  messages: Array<{ id: string; sender_type: string; sender_name: string | null; content: string; created_at: string }>;
  reviews: Array<{ id: string; summary: string; risks: string[]; assumptions: string[]; next_steps: string[]; status: string; recommended_approval: string; created_at: string }>;
  events: Array<{ id: string; event_type: string; summary: string | null; created_at: string }>;
};

function variant(value: string): 'green' | 'yellow' | 'red' | 'blue' | 'muted' | 'default' {
  if (['done', 'approved', 'active'].includes(value)) return 'green';
  if (['running', 'review', 'pending_approval', 'ready'].includes(value)) return 'yellow';
  if (['blocked', 'cancelled', 'rejected'].includes(value)) return 'red';
  if (['high', 'review_required', 'supervised'].includes(value)) return 'blue';
  return 'muted';
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString();
}

export function AiMissionDetailWorkbench({ missionId }: { missionId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await api.get<Detail>(`/api/ai/missions/${missionId}`);
    if (response.ok) setDetail(response.data);
    else setError(response.error.message);
    setLoading(false);
  }, [missionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(action: 'approve' | 'start' | 'send_to_review' | 'complete' | 'block' | 'cancel') {
    setBusyAction(action);
    setError(null);
    const response = await api.patch<Detail>(`/api/ai/missions/${missionId}`, { action });
    setBusyAction(null);
    if (response.ok) setDetail(response.data);
    else setError(response.error.message);
  }

  if (loading) return <SkeletonRows rows={5} />;

  if (error) {
    return (
      <Card className="border-empire-red/20">
        <div className="p-5">
          <EmptyState icon="!" message={error} />
          <div className="mt-4">
            <Button variant="secondary" onClick={() => void load()}>Retry</Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!detail) return <EmptyState message="Mission not found." />;

  const { mission } = detail;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-100">{mission.title}</h2>
              <Badge variant={variant(mission.status)}>{mission.status}</Badge>
              <Badge variant={variant(mission.priority)}>{mission.priority}</Badge>
              <Badge variant={variant(mission.autonomy_level)}>{mission.autonomy_level}</Badge>
            </div>
            <p className="mt-3 max-w-4xl text-sm text-empire-muted">{mission.objective}</p>
            <p className="mt-3 text-xs font-mono text-empire-muted">Created {fmtDate(mission.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busyAction === 'approve'} onClick={() => void transition('approve')}>Approve</Button>
            <Button size="sm" variant="secondary" loading={busyAction === 'start'} onClick={() => void transition('start')}>Start</Button>
            <Button size="sm" variant="secondary" loading={busyAction === 'send_to_review'} onClick={() => void transition('send_to_review')}>Send to review</Button>
            <Button size="sm" variant="secondary" loading={busyAction === 'complete'} onClick={() => void transition('complete')}>Complete</Button>
            <Button size="sm" variant="danger" loading={busyAction === 'block'} onClick={() => void transition('block')}>Block</Button>
            <Button size="sm" variant="ghost" loading={busyAction === 'cancel'} onClick={() => void transition('cancel')}>Cancel</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Mission tasks</p>
          <div className="mt-4 space-y-3">
            {detail.tasks.length === 0 ? <EmptyState message="No tasks generated yet. Approve the mission to create the task plan." /> : null}
            {detail.tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-border bg-surface-0 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-100">{task.title}</p>
                  <Badge variant={variant(task.status)}>{task.status}</Badge>
                </div>
                {task.description && <p className="mt-2 text-sm text-empire-muted">{task.description}</p>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Assigned team</p>
          {detail.team ? (
            <div className="mt-4 rounded-2xl border border-border bg-surface-0 p-4">
              <p className="text-sm font-semibold text-gray-100">{detail.team.name}</p>
              <p className="mt-2 text-sm text-empire-muted">{detail.team.purpose}</p>
              <div className="mt-3"><Badge variant={variant(detail.team.default_autonomy_level)}>{detail.team.default_autonomy_level}</Badge></div>
            </div>
          ) : <EmptyState message="No team assigned." />}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Review packages</p>
          <div className="mt-4 space-y-3">
            {detail.reviews.length === 0 ? <EmptyState message="No review package yet." /> : null}
            {detail.reviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-border bg-surface-0 p-4">
                <div className="flex items-center justify-between gap-3"><p className="text-sm text-gray-100">{review.summary}</p><Badge variant={variant(review.status)}>{review.status}</Badge></div>
                {review.risks.length > 0 && <p className="mt-2 text-xs text-empire-muted">Risks: {review.risks.join('; ')}</p>}
                {review.next_steps.length > 0 && <p className="mt-2 text-xs text-empire-muted">Next: {review.next_steps.join(' → ')}</p>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Events</p>
          <div className="mt-4 space-y-2">
            {detail.events.length === 0 ? <EmptyState message="No mission events yet." /> : null}
            {detail.events.map((event) => (
              <div key={event.id} className="rounded-xl border border-border bg-surface-0 p-3">
                <p className="text-sm text-gray-100">{event.event_type}</p>
                {event.summary && <p className="text-xs text-empire-muted">{event.summary}</p>}
                <p className="mt-1 text-[11px] font-mono text-empire-muted">{fmtDate(event.created_at)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
