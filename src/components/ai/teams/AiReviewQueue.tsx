'use client';

import Link from 'next/link';
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
  created_at: string;
};

function variant(value: string): 'green' | 'yellow' | 'red' | 'blue' | 'muted' | 'default' {
  if (['done', 'approved'].includes(value)) return 'green';
  if (['review', 'pending_approval', 'running'].includes(value)) return 'yellow';
  if (['blocked', 'cancelled', 'urgent'].includes(value)) return 'red';
  if (['high', 'review_required', 'supervised'].includes(value)) return 'blue';
  return 'muted';
}

export function AiReviewQueue() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await api.get<Mission[]>('/api/ai/missions?status=review');
    if (response.ok) setMissions(response.data);
    else setError(response.error.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <SkeletonRows rows={4} />;

  if (error) {
    return (
      <Card className="border-empire-red/20 p-5">
        <EmptyState icon="!" message={error} />
        <div className="mt-4"><Button variant="secondary" onClick={() => void load()}>Retry</Button></div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Mission review queue</p>
        <p className="mt-2 text-sm text-empire-muted">
          Review packages are where AI Teams stop before anything updates the Spine or becomes real execution.
        </p>
      </Card>

      {missions.length === 0 ? <EmptyState message="No missions are currently in review." /> : null}
      {missions.map((mission) => (
        <Link key={mission.id} href={`/ai/missions/${mission.id}`} className="block">
          <Card hover className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-100">{mission.title}</h3>
                  <Badge variant={variant(mission.status)}>{mission.status}</Badge>
                  <Badge variant={variant(mission.priority)}>{mission.priority}</Badge>
                </div>
                <p className="mt-2 max-w-3xl text-sm text-empire-muted">{mission.objective}</p>
              </div>
              <span className="text-sm font-mono text-empire-blue">Open review →</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
