'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { patchJson } from '@/lib/http';
import type { RiskLevel, UpsideLevel } from '@/spine/ai/ai.types';

export interface RecommendationRow {
  id: string;
  recommendation: string;
  reasoning: string | null;
  confidence: number | null;
  risk_level: RiskLevel | null;
  upside_level: UpsideLevel | null;
  source_type: string;
  accepted_at: string | null;
  dismissed_at: string | null;
}

function levelVariant(l: string | null): 'green' | 'yellow' | 'red' | 'muted' {
  if (l === 'low') return 'green';
  if (l === 'medium') return 'yellow';
  if (l === 'high') return 'red';
  return 'muted';
}

export function AiRecommendationsPanel({ initial }: { initial: RecommendationRow[] }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, action: 'accept' | 'dismiss') {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              accepted_at: action === 'accept' ? new Date().toISOString() : null,
              dismissed_at: action === 'dismiss' ? new Date().toISOString() : null,
            }
          : r,
      ),
    );
    try {
      await patchJson('/api/ai/recommendations', { id, action });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  }

  if (rows.length === 0) {
    return (
      <Card>
        <div className="p-8 text-center text-sm text-empire-muted font-mono">
          No recommendations yet. Run the AI Chief of Staff to generate some.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-empire-red font-mono">{error}</p>}
      {rows.map((r) => {
        const acted = Boolean(r.accepted_at || r.dismissed_at);
        return (
          <Card key={r.id} className={acted ? 'opacity-60' : ''}>
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-100">{r.recommendation}</p>
                <span className="text-[10px] font-mono text-empire-muted shrink-0">
                  {r.source_type}
                </span>
              </div>
              {r.reasoning && <p className="text-xs text-empire-muted">{r.reasoning}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {r.confidence != null && (
                  <Badge variant="blue">conf {Math.round(r.confidence * 100)}%</Badge>
                )}
                {r.risk_level && (
                  <Badge variant={levelVariant(r.risk_level)}>risk {r.risk_level}</Badge>
                )}
                {r.upside_level && (
                  <Badge variant={levelVariant(r.upside_level) === 'red' ? 'green' : 'muted'}>
                    upside {r.upside_level}
                  </Badge>
                )}
              </div>
              {!acted && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="primary" onClick={() => decide(r.id, 'accept')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => decide(r.id, 'dismiss')}>
                    Dismiss
                  </Button>
                </div>
              )}
              {r.accepted_at && <span className="text-[10px] font-mono text-empire-green">accepted</span>}
              {r.dismissed_at && <span className="text-[10px] font-mono text-empire-muted">dismissed</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
