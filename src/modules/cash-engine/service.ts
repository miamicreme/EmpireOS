/**
 * Cash Engine module. Owns cash_entries; surfaces cash metrics, actions, and a
 * decision context to the Spine via the ModuleContract.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { todayISODate } from '@/lib/dates';
import type { ModuleContract } from '@/spine/module-contract';
import type { CashEntry } from '@/spine/types';
import {
  createCashEntrySchema,
  updateCashEntrySchema,
  type CreateCashEntryInput,
  type UpdateCashEntryInput,
} from '@/spine/schemas';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';
import { getMetrics } from './metrics';
import { getActions } from './actions';
import { getDecisionContext } from './decisions';
import { getHealth } from './metrics';

const TABLE = 'cash_entries';

export async function createCashEntry(
  supabase: SupabaseClient,
  userId: string,
  input: CreateCashEntryInput,
): Promise<AppResult<CashEntry>> {
  const parsed = createCashEntrySchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid cash entry.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));

  await emitSystemEvent(supabase, userId, {
    event_name: 'cash.entry.created',
    event_type: 'created',
    module_id: manifest.id,
    entity_type: 'cash_entry',
    entity_id: (data as CashEntry).id,
    payload: { net_amount: (data as CashEntry).net_amount },
  });

  return ok(data as CashEntry);
}

export async function getCashEntriesForDate(
  supabase: SupabaseClient,
  userId: string,
  date: string = todayISODate(),
): Promise<AppResult<CashEntry[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as CashEntry[]);
}

export async function updateCashEntry(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateCashEntryInput,
): Promise<AppResult<CashEntry>> {
  const parsed = updateCashEntrySchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid cash entry update.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Cash entry not found.'));
  return ok(data as CashEntry);
}

export async function deleteCashEntry(
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

export const cashEngineModule: ModuleContract = {
  manifest,
  getMetrics: (userId) => getMetrics(createClient(), userId),
  getActions: (userId) => getActions(createClient(), userId),
  getDecisionContext: (userId) => getDecisionContext(createClient(), userId),
  getHealth: (userId) => getHealth(createClient(), userId),
  syncToSpine: async (userId) => {
    const supabase = createClient();
    await emitSystemEvent(supabase, userId, {
      event_name: 'module.synced',
      event_type: 'synced',
      module_id: manifest.id,
      payload: {},
    });
  },
};
