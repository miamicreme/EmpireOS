import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModuleMetric } from '@/spine/types';
import { manifest } from './manifest';

/**
 * Compute the module's metrics for a user. Return an array of ModuleMetric-shaped
 * objects (id/created_at may be synthetic for derived metrics).
 */
export async function getMetrics(
  _supabase: SupabaseClient,
  _userId: string,
): Promise<ModuleMetric[]> {
  // Replace with real queries against this module's tables.
  void manifest;
  return [];
}
