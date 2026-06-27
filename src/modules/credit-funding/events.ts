import type { SupabaseClient } from '@supabase/supabase-js';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';

export async function emitCreditEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await emitSystemEvent(supabase, userId, {
    event_name: `credit-funding.${eventType}`,
    event_type: 'created',
    module_id: manifest.id,
    payload,
  });
}
