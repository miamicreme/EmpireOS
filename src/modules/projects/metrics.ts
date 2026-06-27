import type { SupabaseClient } from '@supabase/supabase-js';
import { todayISODate } from '@/lib/dates';
import type { Project, ModuleMetric, ModuleHealthResult } from '@/spine/types';
import { manifest } from './manifest';

type ProjectRow = Pick<Project, 'status' | 'blocker'>;

async function loadProjects(supabase: SupabaseClient, userId: string): Promise<ProjectRow[]> {
  const { data } = await supabase
    .from('projects')
    .select('status, blocker')
    .eq('user_id', userId);
  return (data ?? []) as ProjectRow[];
}

export async function getMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleMetric[]> {
  const projects = await loadProjects(supabase, userId);
  const active = projects.filter((p) => p.status === 'active').length;
  const parked = projects.filter((p) => p.status === 'paused').length;
  const blocked = projects.filter((p) => p.status === 'active' && p.blocker !== null).length;

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
    { ...base, id: 'derived:active_projects', metric_key: 'active_projects', metric_label: 'Active Projects', metric_value: active },
    { ...base, id: 'derived:parked_projects', metric_key: 'parked_projects', metric_label: 'Parked Projects', metric_value: parked },
    { ...base, id: 'derived:blocked_projects', metric_key: 'blocked_projects', metric_label: 'Blocked Projects', metric_value: blocked },
  ];
}

export async function getHealth(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleHealthResult> {
  const projects = await loadProjects(supabase, userId);
  const active = projects.filter((p) => p.status === 'active').length;
  if (active > 5) {
    return { moduleId: manifest.id, health: 'red', reason: `${active} active projects — distraction risk. Aim for ≤3.` };
  }
  if (active > 3) {
    return { moduleId: manifest.id, health: 'yellow', reason: `${active} active projects. Consider parking some.` };
  }
  return { moduleId: manifest.id, health: 'green', reason: `${active} active project${active !== 1 ? 's' : ''} — focused.` };
}
