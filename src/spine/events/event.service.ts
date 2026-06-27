/**
 * System Event service. The high-tech event layer that future automations
 * (notifications, AI triggers, syncs) subscribe to.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { nowISO } from '@/lib/dates';
import { createSystemEventSchema, type CreateSystemEventInput } from '../schemas';
import type { SystemEvent } from '../types';

const TABLE = 'system_events';

export async function emitSystemEvent(
  supabase: SupabaseClient,
  userId: string,
  input: CreateSystemEventInput,
): Promise<AppResult<SystemEvent>> {
  const parsed = createSystemEventSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid system event.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as SystemEvent);
}

export async function markEventProcessed(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<AppResult<SystemEvent>> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ processed_at: nowISO() })
    .eq('id', eventId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Event not found.'));
  return ok(data as SystemEvent);
}

export async function getUnprocessedEvents(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<SystemEvent[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .is('processed_at', null)
    .order('created_at', { ascending: true });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as SystemEvent[]);
}
