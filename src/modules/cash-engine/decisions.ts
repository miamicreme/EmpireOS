import type { SupabaseClient } from '@supabase/supabase-js';
import { todayISODate } from '@/lib/dates';
import type { DecisionContext } from '@/spine/types';
import { manifest } from './manifest';

export async function getDecisionContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecisionContext> {
  const { data } = await supabase
    .from('cash_entries')
    .select('net_amount, source')
    .eq('user_id', userId)
    .eq('date', todayISODate());

  const entries = (data ?? []) as { net_amount: number; source: string }[];
  const net = entries.reduce((s, e) => s + Number(e.net_amount ?? 0), 0);

  return {
    moduleId: manifest.id,
    summary: `Today net cash: ${net} across ${entries.length} entries.`,
    facts: { todayNet: net, entryCount: entries.length },
    risks: net <= 0 ? ['No cash generated today.'] : [],
    opportunities: ['Identify the highest hourly cash source and double down.'],
    recommendedActions:
      net <= 0 ? ['Log at least one cash activity today.'] : [],
  };
}
