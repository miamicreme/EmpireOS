import type { SupabaseClient } from '@supabase/supabase-js';
import { todayISODate } from '@/lib/dates';
import type { JobApplication, ModuleMetric, ModuleHealthResult } from '@/spine/types';
import { manifest } from './manifest';

const ACTIVE: JobApplication['status'][] = ['applied', 'interviewing', 'offer'];

async function loadApplications(
  supabase: SupabaseClient,
  userId: string,
): Promise<JobApplication[]> {
  const { data } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId);
  return (data ?? []) as JobApplication[];
}

export async function getMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleMetric[]> {
  const apps = await loadApplications(supabase, userId);
  const active = apps.filter((a) => ACTIVE.includes(a.status)).length;
  const interviewing = apps.filter((a) => a.status === 'interviewing').length;
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
    { ...base, id: 'derived:active_apps', metric_key: 'active_apps', metric_label: 'Active Applications', metric_value: active },
    { ...base, id: 'derived:interviewing', metric_key: 'interviewing', metric_label: 'Interviewing', metric_value: interviewing },
  ];
}

export async function getHealth(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleHealthResult> {
  const apps = await loadApplications(supabase, userId);
  const active = apps.filter((a) => ACTIVE.includes(a.status)).length;
  if (active >= 5) {
    return { moduleId: manifest.id, health: 'green', reason: 'Healthy active pipeline.' };
  }
  if (active >= 1) {
    return { moduleId: manifest.id, health: 'yellow', reason: 'Thin pipeline; add applications.' };
  }
  return { moduleId: manifest.id, health: 'red', reason: 'No active applications.' };
}
