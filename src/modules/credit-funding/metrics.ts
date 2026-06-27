import type { SupabaseClient } from '@supabase/supabase-js';
import { todayISODate } from '@/lib/dates';
import type { CreditItem, ModuleMetric, ModuleHealthResult } from '@/spine/types';
import { manifest } from './manifest';

type ItemRow = Pick<CreditItem, 'status'>;

async function loadItems(supabase: SupabaseClient, userId: string): Promise<ItemRow[]> {
  const { data } = await supabase
    .from('credit_items')
    .select('status')
    .eq('user_id', userId);
  return (data ?? []) as ItemRow[];
}

function computeReadinessScore(items: ItemRow[]): number {
  if (items.length === 0) return 0;
  const resolved = items.filter((i) => i.status === 'resolved').length;
  const disputing = items.filter((i) => i.status === 'disputing').length;
  const open = items.filter((i) => i.status === 'open').length;
  // Score: resolved items contribute 100%, disputing 50%, open 0%, archived ignored
  const eligible = items.filter((i) => i.status !== 'archived').length;
  if (eligible === 0) return 100;
  const raw = (resolved * 100 + disputing * 50 + open * 0) / eligible;
  return Math.round(raw);
}

export async function getMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleMetric[]> {
  const items = await loadItems(supabase, userId);
  const openDisputes = items.filter((i) => i.status === 'disputing').length;
  const inProgress = items.filter((i) => i.status === 'open').length;
  const complete = items.filter((i) => i.status === 'resolved').length;
  const score = computeReadinessScore(items);

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
    {
      ...base,
      id: 'derived:funding_readiness_score',
      metric_key: 'funding_readiness_score',
      metric_label: 'Funding Readiness Score',
      metric_value: score,
      unit: 'score',
      target_value: 70,
    },
    {
      ...base,
      id: 'derived:open_disputes',
      metric_key: 'open_disputes',
      metric_label: 'Open Disputes',
      metric_value: openDisputes,
    },
    {
      ...base,
      id: 'derived:items_in_progress',
      metric_key: 'items_in_progress',
      metric_label: 'Items In Progress',
      metric_value: inProgress,
    },
    {
      ...base,
      id: 'derived:items_complete',
      metric_key: 'items_complete',
      metric_label: 'Items Complete',
      metric_value: complete,
    },
  ];
}

export async function getHealth(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleHealthResult> {
  const items = await loadItems(supabase, userId);
  if (items.length === 0) {
    return { moduleId: manifest.id, health: 'yellow', reason: 'No credit items tracked yet.' };
  }
  const openDisputes = items.filter((i) => i.status === 'disputing').length;
  if (openDisputes > 3) {
    return { moduleId: manifest.id, health: 'red', reason: `${openDisputes} open disputes need attention.` };
  }
  const score = computeReadinessScore(items);
  if (score >= 70) {
    return { moduleId: manifest.id, health: 'green', reason: `Funding readiness score: ${score}/100.` };
  }
  return { moduleId: manifest.id, health: 'yellow', reason: `Funding readiness score: ${score}/100. Aim for 70+.` };
}
