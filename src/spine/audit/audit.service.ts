/**
 * Audit service. Records an immutable trail of meaningful events. Audit rows
 * are insert + read only (no update/delete policy in the DB).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { createAuditEventSchema, type CreateAuditEventInput } from '../schemas';
import type { AuditEvent } from '../types';

const TABLE = 'audit_events';

export async function recordAuditEvent(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAuditEventInput,
): Promise<AppResult<AuditEvent>> {
  const parsed = createAuditEventSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid audit event.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as AuditEvent);
}

export async function getAuditTrail(
  supabase: SupabaseClient,
  userId: string,
  entityType: string,
  entityId: string,
): Promise<AppResult<AuditEvent[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as AuditEvent[]);
}
