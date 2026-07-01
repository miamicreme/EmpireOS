'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { postJson } from '@/lib/http';
import type { DailyBriefOutput } from '@/spine/ai/ai.types';

function List({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-empire-muted mb-1.5">
        {title}
      </div>
      <ul className="text-sm text-gray-200 space-y-1 list-disc list-inside">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export function AiBriefPanel({ initial }: { initial: DailyBriefOutput | null }) {
  const [brief, setBrief] = useState<DailyBriefOutput | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ brief: DailyBriefOutput }>('/api/ai/brief', {
        briefType: 'daily',
        persist: true,
      });
      setBrief(data.brief);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate brief');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Daily Brief"
        subtitle={brief?.recommendedFocus ? `Focus: ${brief.recommendedFocus}` : 'Today'}
        action={
          <Button size="sm" variant="primary" loading={loading} onClick={generate}>
            {brief ? 'Regenerate' : 'Generate'}
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        {error && <p className="text-xs text-empire-red font-mono">{error}</p>}
        {!brief && !loading && (
          <p className="text-sm text-empire-muted font-mono">
            No brief yet. Generate today&apos;s brief to see your cash target, top actions, and risks.
          </p>
        )}
        {brief && (
          <>
            <p className="text-sm text-gray-200">{brief.summary}</p>
            <div className="flex flex-wrap gap-2">
              {brief.cashTarget != null && (
                <Badge variant="green">cash target ${brief.cashTarget}</Badge>
              )}
              <Badge variant="blue">confidence {Math.round(brief.confidence * 100)}%</Badge>
            </div>
            <List title="Top actions" items={brief.topActions.map((a) => a.title)} />
            <List title="Follow-ups due" items={brief.followUps} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {brief.jobHuntPriority && (
                <List title="Job hunt priority" items={[brief.jobHuntPriority]} />
              )}
              {brief.projectPriority && (
                <List title="Project priority" items={[brief.projectPriority]} />
              )}
            </div>
            <List title="Risks" items={brief.risks} />
            <List title="Opportunities" items={brief.opportunities} />
          </>
        )}
      </div>
    </Card>
  );
}
