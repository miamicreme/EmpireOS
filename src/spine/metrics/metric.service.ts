/**
 * Module Metric service. Records and reads time-stamped metric snapshots that
 * modules push into the Spine.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { todayISODate, isoDateDaysAgo } from '@/lib/dates';
import { createModuleMetricSchema, type CreateModuleMetricInput } from '../schemas';
import type { ModuleMetric } from '../types';

const TABLE = 'module_metrics';

export async function recordMetric(
  supabase: SupabaseClient,
  userId: string,
  input: CreateModuleMetricInput,
): Promise<AppResult<ModuleMetric>> {
  const parsed = createModuleMetricSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid metric input.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as ModuleMetric);
}

export async function getTodayMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<ModuleMetric[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayISODate());

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as ModuleMetric[]);
}

export async function getMetricsByModule(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
): Promise<AppResult<ModuleMetric[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .order('date', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as ModuleMetric[]);
}

export async function getMetricTrend(
  supabase: SupabaseClient,
  userId: string,
  metricKey: string,
  days: number,
): Promise<AppResult<ModuleMetric[]>> {
  const since = isoDateDaysAgo(Math.max(0, days));
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('metric_key', metricKey)
    .gte('date', since)
    .order('date', { ascending: true });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as ModuleMetric[]);
}
