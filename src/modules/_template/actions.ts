import type { SupabaseClient } from '@supabase/supabase-js';
import type { GlobalAction } from '@/spine/types';
import { getActionsByModule } from '@/spine/actions/action.service';
import { manifest } from './manifest';

/** Return this module's open actions from the shared global_actions table. */
export async function getActions(
  supabase: SupabaseClient,
  userId: string,
): Promise<GlobalAction[]> {
  const res = await getActionsByModule(supabase, userId, manifest.id);
  return res.ok ? res.data : [];
}
