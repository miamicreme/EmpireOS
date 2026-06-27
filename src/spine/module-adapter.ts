/**
 * Module Adapter V3.
 *
 * Converts module outputs (metrics, actions, events) into Spine DB records.
 * Uses the server Supabase client so RLS is enforced on every write.
 */
import { createClient } from '@/lib/supabase/server';
import { emitSystemEvent } from '@/spine/events/event.service';
import { todayISODate } from '@/lib/dates';
import type { ModuleMetric } from '@/spine/types';
import type { ModuleAction } from '@/spine/module-contract';

/**
 * Upsert module metrics into module_metrics.
 * Conflict key: (user_id, module_id, metric_key, date).
 */
export async function syncModuleMetricsToSpine(
  userId: string,
  moduleId: string,
  metrics: ModuleMetric[],
): Promise<void> {
  const supabase = createClient();
  const today = todayISODate();
  for (const metric of metrics) {
    await supabase.from('module_metrics').upsert(
      {
        user_id: userId,
        module_id: moduleId,
        metric_key: metric.metric_key,
        metric_label: metric.metric_label,
        metric_value: metric.metric_value,
        metric_text: metric.metric_text ?? null,
        target_value: metric.target_value ?? null,
        unit: metric.unit ?? null,
        date: today,
        trend_direction: metric.trend_direction ?? null,
        metadata: metric.metadata ?? {},
      },
      { onConflict: 'user_id,module_id,metric_key,date' },
    );
  }
}

/**
 * Insert module actions into global_actions, deduplicating via
 * metadata.dedupe_key when present.
 */
export async function syncModuleActionsToSpine(
  userId: string,
  moduleId: string,
  actions: ModuleAction[],
): Promise<void> {
  const supabase = createClient();
  for (const action of actions) {
    const dedupeKey = action.metadata?.dedupe_key as string | undefined;
    if (dedupeKey) {
      const { data: existing } = await supabase
        .from('global_actions')
        .select('id')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .contains('metadata', { dedupe_key: dedupeKey })
        .maybeSingle();
      if (existing) continue;
    }
    await supabase.from('global_actions').insert({
      user_id: userId,
      module_id: moduleId,
      title: action.title,
      description: action.description,
      category: 'general',
      priority: action.priority,
      due_at: action.dueAt ?? null,
      impact_score: (action.metadata?.impact_score as number | undefined) ?? 5,
      urgency_score: (action.metadata?.urgency_score as number | undefined) ?? 5,
      effort_score: (action.metadata?.effort_score as number | undefined) ?? 5,
      confidence_score: (action.metadata?.confidence_score as number | undefined) ?? 0.5,
      metadata: action.metadata ?? {},
      source_type: 'module',
    });
  }
}

/**
 * Emit a module event into the system_events table via the event service.
 */
export async function recordModuleEvent(
  userId: string,
  moduleId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient();
  await emitSystemEvent(supabase, userId, {
    event_name: `${moduleId}:${eventType}`,
    event_type: 'created',
    module_id: moduleId,
    payload,
  });
}
