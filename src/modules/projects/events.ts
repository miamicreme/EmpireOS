import type { SupabaseClient } from '@supabase/supabase-js';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';

export async function emitProjectEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await emitSystemEvent(supabase, userId, {
    event_name: `projects.${eventType}`,
    event_type: 'created',
    module_id: manifest.id,
    payload,
  });
}
