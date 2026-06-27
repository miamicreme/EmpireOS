import type { SupabaseClient } from '@supabase/supabase-js';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';

/** Emit a "module.synced" system event for this module. */
export async function emitSyncedEvent(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await emitSystemEvent(supabase, userId, {
    event_name: 'module.synced',
    event_type: 'synced',
    module_id: manifest.id,
    payload: {},
  });
}
