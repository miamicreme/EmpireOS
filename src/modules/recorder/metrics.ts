import type { SupabaseClient } from '@supabase/supabase-js';
import { todayISODate } from '@/lib/dates';
import type { Recording, ModuleMetric, ModuleHealthResult } from '@/spine/types';
import { manifest } from './manifest';

type RecordingRow = Pick<Recording, 'status'>;

async function loadRecordings(supabase: SupabaseClient, userId: string): Promise<RecordingRow[]> {
  const { data } = await supabase.from('recordings').select('status').eq('user_id', userId);
  return (data ?? []) as RecordingRow[];
}

const PENDING_STATUSES = new Set([
  'uploaded',
  'transcribing',
  'transcribed',
  'translating',
  'translated',
  'analyzing',
]);

export async function getMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleMetric[]> {
  const recordings = await loadRecordings(supabase, userId);
  const total = recordings.length;
  const pending = recordings.filter((r) => PENDING_STATUSES.has(r.status)).length;
  const failed = recordings.filter((r) => r.status === 'failed').length;
  const ready = recordings.filter((r) => r.status === 'ready').length;

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
    { ...base, id: 'derived:recordings_total', metric_key: 'recordings_total', metric_label: 'Recordings', metric_value: total },
    { ...base, id: 'derived:recordings_ready', metric_key: 'recordings_ready', metric_label: 'Ready', metric_value: ready },
    { ...base, id: 'derived:recordings_pending', metric_key: 'recordings_pending', metric_label: 'Processing', metric_value: pending },
    { ...base, id: 'derived:recordings_failed', metric_key: 'recordings_failed', metric_label: 'Failed', metric_value: failed },
  ];
}

/** Red if any recording failed the pipeline, yellow while any is processing, green otherwise. */
export async function getHealth(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleHealthResult> {
  const recordings = await loadRecordings(supabase, userId);
  const failed = recordings.filter((r) => r.status === 'failed').length;
  const pending = recordings.filter((r) => PENDING_STATUSES.has(r.status)).length;

  if (failed > 0) {
    return { moduleId: manifest.id, health: 'red', reason: `${failed} recording${failed !== 1 ? 's' : ''} failed processing.` };
  }
  if (pending > 0) {
    return { moduleId: manifest.id, health: 'yellow', reason: `${pending} recording${pending !== 1 ? 's' : ''} still processing.` };
  }
  return { moduleId: manifest.id, health: 'green', reason: 'All recordings processed cleanly.' };
}
