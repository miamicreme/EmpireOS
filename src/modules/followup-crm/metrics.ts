import type { SupabaseClient } from '@supabase/supabase-js';
import { nowISO, todayISODate } from '@/lib/dates';
import type { Contact, ModuleMetric, ModuleHealthResult } from '@/spine/types';
import { manifest } from './manifest';

async function loadDueCounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ dueNow: number; total: number }> {
  const { data } = await supabase
    .from('contacts')
    .select('next_follow_up_at, status')
    .eq('user_id', userId);
  const contacts = (data ?? []) as Pick<Contact, 'next_follow_up_at' | 'status'>[];
  const now = nowISO();
  const dueNow = contacts.filter(
    (c) => c.next_follow_up_at !== null && c.next_follow_up_at <= now && c.status !== 'archived',
  ).length;
  return { dueNow, total: contacts.length };
}

export async function getMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleMetric[]> {
  const { dueNow, total } = await loadDueCounts(supabase, userId);
  const created = new Date().toISOString();
  const base = {
    user_id: userId,
    module_id: manifest.id,
    metric_text: null,
    target_value: null,
    unit: 'count',
    date: todayISODate(),
    trend_direction: null,
    metadata: {},
    created_at: created,
  } as const;
  return [
    { ...base, id: 'derived:followups_due', metric_key: 'followups_due', metric_label: 'Follow-ups Due', metric_value: dueNow },
    { ...base, id: 'derived:contacts_total', metric_key: 'contacts_total', metric_label: 'Total Contacts', metric_value: total },
  ];
}

export async function getHealth(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleHealthResult> {
  const { dueNow } = await loadDueCounts(supabase, userId);
  if (dueNow === 0) {
    return { moduleId: manifest.id, health: 'green', reason: 'No follow-ups overdue.' };
  }
  if (dueNow <= 3) {
    return { moduleId: manifest.id, health: 'yellow', reason: `${dueNow} follow-ups due.` };
  }
  return { moduleId: manifest.id, health: 'red', reason: `${dueNow} follow-ups overdue.` };
}
