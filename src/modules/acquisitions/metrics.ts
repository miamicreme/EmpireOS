import type { SupabaseClient } from '@supabase/supabase-js';
import { todayISODate, weekStartISODate } from '@/lib/dates';
import type { AcquisitionTarget, ModuleMetric, ModuleHealthResult } from '@/spine/types';
import { manifest } from './manifest';

type TargetRow = Pick<AcquisitionTarget, 'status' | 'seller_financing_possible' | 'created_at'>;

const INACTIVE_STATUSES: AcquisitionTarget['status'][] = ['closed', 'passed'];

async function loadTargets(supabase: SupabaseClient, userId: string): Promise<TargetRow[]> {
  const { data } = await supabase
    .from('acquisition_targets')
    .select('status, seller_financing_possible, created_at')
    .eq('user_id', userId);
  return (data ?? []) as TargetRow[];
}

export async function getMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleMetric[]> {
  const targets = await loadTargets(supabase, userId);
  const weekStart = weekStartISODate();
  const active = targets.filter((t) => !INACTIVE_STATUSES.includes(t.status)).length;
  const reviewedThisWeek = targets.filter((t) => t.created_at >= weekStart).length;
  const sellerFinancing = targets.filter((t) => t.seller_financing_possible).length;

  const now = new Date().toISOString();
  const base = {
    user_id: userId,
    module_id: manifest.id,
    metric_text: null,
    target_value: null,
    unit: 'count',
    date: todayISODate(),
    trend_direction: null,
    metadata: {},
    created_at: now,
  } as const;

  return [
    { ...base, id: 'derived:active_targets', metric_key: 'active_targets', metric_label: 'Active Targets', metric_value: active },
    { ...base, id: 'derived:targets_reviewed_this_week', metric_key: 'targets_reviewed_this_week', metric_label: 'Targets Reviewed This Week', metric_value: reviewedThisWeek },
    { ...base, id: 'derived:seller_financing_targets', metric_key: 'seller_financing_targets', metric_label: 'Seller Financing Targets', metric_value: sellerFinancing },
  ];
}

export async function getHealth(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleHealthResult> {
  const targets = await loadTargets(supabase, userId);
  if (targets.length === 0) {
    return { moduleId: manifest.id, health: 'red', reason: 'No acquisition targets being tracked.' };
  }
  const weekStart = weekStartISODate();
  const reviewedThisWeek = targets.filter((t) => t.created_at >= weekStart).length;
  if (reviewedThisWeek === 0) {
    return { moduleId: manifest.id, health: 'yellow', reason: 'No targets reviewed this week.' };
  }
  const active = targets.filter((t) => !INACTIVE_STATUSES.includes(t.status)).length;
  if (active > 0) {
    return { moduleId: manifest.id, health: 'green', reason: `${active} active target${active !== 1 ? 's' : ''} in pipeline.` };
  }
  return { moduleId: manifest.id, health: 'yellow', reason: 'No active targets in pipeline.' };
}
