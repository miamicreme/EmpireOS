import { createClient } from '@/lib/supabase/server';
import { todayISODate } from '@/lib/dates';
import type { ModuleContract } from '@/spine/module-contract';
import type { DecisionContext, ModuleHealthResult, ModuleMetric } from '@/spine/types';
import { syncModuleMetricsToSpine } from '@/spine/module-adapter';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';

async function getMetrics(userId: string): Promise<ModuleMetric[]> {
  const supabase = createClient();
  const [{ count: total }, { count: published }, { count: failed }] = await Promise.all([
    supabase.from('content_runs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('content_runs').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'published'),
    supabase.from('content_runs').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'failed'),
  ]);
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
    { ...base, id: 'derived:content_runs', metric_key: 'content_runs', metric_label: 'Content Runs', metric_value: total ?? 0 },
    { ...base, id: 'derived:content_published', metric_key: 'content_published', metric_label: 'Published', metric_value: published ?? 0 },
    { ...base, id: 'derived:content_failed', metric_key: 'content_failed', metric_label: 'Failed', metric_value: failed ?? 0 },
  ];
}

async function getDecisionContext(userId: string): Promise<DecisionContext> {
  const metrics = await getMetrics(userId);
  const values = Object.fromEntries(metrics.map((m) => [m.metric_key, m.metric_value]));
  return {
    moduleId: manifest.id,
    summary: `${values.content_published ?? 0} items published from ${values.content_runs ?? 0} tracked content runs.`,
    facts: values,
    risks: (values.content_failed ?? 0) > 0 ? ['One or more content runs failed and need review.'] : [],
    opportunities: ['Use KJB Personal as the primary public outlet while Empire owns intelligence and approvals.'],
    recommendedActions: (values.content_failed ?? 0) > 0 ? ['Review failed publishing receipts.'] : ['Create the next authority-building content package.'],
  };
}

async function getHealth(userId: string): Promise<ModuleHealthResult> {
  const supabase = createClient();
  const { count, error } = await supabase.from('content_runs').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'failed');
  if (error) return { moduleId: manifest.id, health: 'red', reason: error.message };
  if ((count ?? 0) > 0) return { moduleId: manifest.id, health: 'yellow', reason: `${count} failed content run(s) require attention.` };
  return { moduleId: manifest.id, health: 'green', reason: 'Content intelligence pipeline is healthy.' };
}

export const contentIntelligenceModule: ModuleContract = {
  manifest,
  getMetrics,
  getActions: async () => [],
  getDecisionContext,
  getHealth,
  syncToSpine: async (userId) => {
    const metrics = await getMetrics(userId);
    await syncModuleMetricsToSpine(userId, manifest.id, metrics);
    await emitSystemEvent(createClient(), userId, {
      event_name: 'content_intelligence.synced',
      event_type: 'synced',
      module_id: manifest.id,
      payload: {},
    });
  },
};
