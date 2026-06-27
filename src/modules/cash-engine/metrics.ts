import type { SupabaseClient } from '@supabase/supabase-js';
import { todayISODate } from '@/lib/dates';
import type { CashEntry, ModuleMetric, ModuleHealthResult } from '@/spine/types';
import { manifest } from './manifest';

/** Sum today's net cash and compare to the profile daily target. */
async function todayNetAndTarget(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ net: number; target: number }> {
  const [{ data: entries }, { data: profile }] = await Promise.all([
    supabase
      .from('cash_entries')
      .select('net_amount')
      .eq('user_id', userId)
      .eq('date', todayISODate()),
    supabase
      .from('profiles')
      .select('daily_cash_target')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  const net = ((entries ?? []) as Pick<CashEntry, 'net_amount'>[]).reduce(
    (s, e) => s + Number(e.net_amount ?? 0),
    0,
  );
  const target = Number(
    (profile as { daily_cash_target?: number } | null)?.daily_cash_target ?? 250,
  );
  return { net, target };
}

export async function getMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleMetric[]> {
  const { net, target } = await todayNetAndTarget(supabase, userId);
  const now = new Date().toISOString();
  return [
    {
      id: `derived:cash_today:${todayISODate()}`,
      user_id: userId,
      module_id: manifest.id,
      metric_key: 'cash_today',
      metric_label: 'Cash Today',
      metric_value: net,
      metric_text: null,
      target_value: target,
      unit: 'USD',
      date: todayISODate(),
      trend_direction: null,
      metadata: {},
      created_at: now,
    },
  ];
}

/** Green if at/over target, yellow if partial, red if zero. */
export async function getHealth(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleHealthResult> {
  const { net, target } = await todayNetAndTarget(supabase, userId);
  if (net >= target && target > 0) {
    return { moduleId: manifest.id, health: 'green', reason: 'Daily cash target met.' };
  }
  if (net > 0) {
    return { moduleId: manifest.id, health: 'yellow', reason: 'Partial progress to target.' };
  }
  return { moduleId: manifest.id, health: 'red', reason: 'No cash logged today.' };
}
