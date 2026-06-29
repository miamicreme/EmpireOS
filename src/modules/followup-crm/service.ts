/**
 * Follow-Up CRM module. Owns contacts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import type { ModuleContract } from '@/spine/module-contract';
import type { Contact } from '@/spine/types';
import {
  createContactSchema,
  updateContactSchema,
  type CreateContactInput,
  type UpdateContactInput,
} from '@/spine/schemas';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';
import { getMetrics, getHealth } from './metrics';
import { getActions } from './actions';
import { getDecisionContext } from './decisions';

const TABLE = 'contacts';

export async function createContact(
  supabase: SupabaseClient,
  userId: string,
  input: CreateContactInput,
): Promise<AppResult<Contact>> {
  const parsed = createContactSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid contact.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as Contact);
}

export async function getContacts(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<Contact[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as Contact[]);
}

export async function updateContact(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateContactInput,
): Promise<AppResult<Contact>> {
  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid contact update.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Contact not found.'));
  return ok(data as Contact);
}

export async function deleteContact(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<{ id: string }>> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return err(appError('db_error', error.message));
  return ok({ id });
}

export const followupCrmModule: ModuleContract = {
  manifest,
  getMetrics: (userId) => getMetrics(createClient(), userId),
  getActions: (userId) => getActions(createClient(), userId),
  getDecisionContext: (userId) => getDecisionContext(createClient(), userId),
  getHealth: (userId) => getHealth(createClient(), userId),
  syncToSpine: async (userId) => {
    await emitSystemEvent(createClient(), userId, {
      event_name: 'module.synced',
      event_type: 'synced',
      module_id: manifest.id,
      payload: {},
    });
  },
};
