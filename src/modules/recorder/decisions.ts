import type { SupabaseClient } from '@supabase/supabase-js';
import type { Recording, DecisionContext } from '@/spine/types';
import { manifest } from './manifest';

type Row = Pick<Recording, 'title' | 'status' | 'summary' | 'created_at'>;

export async function getDecisionContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecisionContext> {
  const { data } = await supabase
    .from('recordings')
    .select('title, status, summary, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const recordings = (data ?? []) as Row[];
  const failed = recordings.filter((r) => r.status === 'failed').length;
  const readyWithSummary = recordings.filter((r) => r.status === 'ready' && r.summary);

  return {
    moduleId: manifest.id,
    summary: `${recordings.length} recent recordings, ${failed} failed to process.`,
    facts: {
      recentCount: recordings.length,
      failedCount: failed,
      latestSummaries: readyWithSummary.slice(0, 3).map((r) => ({ title: r.title, summary: r.summary })),
    },
    risks: failed > 0 ? [`${failed} recording${failed !== 1 ? 's' : ''} failed to transcribe or analyze.`] : [],
    opportunities:
      readyWithSummary.length > 0
        ? ['Review the latest recording summary for decisions and follow-ups to act on.']
        : [],
    recommendedActions: failed > 0 ? ['Retry or delete the failed recording.'] : [],
  };
}
