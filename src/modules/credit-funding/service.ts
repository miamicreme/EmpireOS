/**
 * Credit & Funding module. Owns credit_items; surfaces credit metrics,
 * actions, and a decision context to the Spine via the ModuleContract.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import type { ModuleContract } from '@/spine/module-contract';
import type { CreditItem } from '@/spine/types';
import { emitSystemEvent } from '@/spine/events/event.service';
import { syncModuleMetricsToSpine } from '@/spine/module-adapter';
import { manifest } from './manifest';
import { getMetrics, getHealth } from './metrics';
import { getActions } from './actions';
import { getDecisionContext } from './decisions';
import { createCreditItemSchema, updateCreditItemSchema } from './schemas';
import type { CreateCreditItemInput, UpdateCreditItemInput } from './schemas';

const TABLE = 'credit_items';

export async function createCreditItem(
  supabase: SupabaseClient,
  userId: string,
  input: CreateCreditItemInput,
): Promise<AppResult<CreditItem>> {
  const parsed = createCreditItemSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid credit item.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));

  await emitSystemEvent(supabase, userId, {
    event_name: 'credit-funding.item.created',
    event_type: 'created',
    module_id: manifest.id,
    entity_type: 'credit_item',
    entity_id: (data as CreditItem).id,
    payload: { status: (data as CreditItem).status },
  });

  return ok(data as CreditItem);
}

export async function updateCreditItem(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateCreditItemInput,
): Promise<AppResult<CreditItem>> {
  const parsed = updateCreditItemSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid credit item update.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Credit item not found.'));
  return ok(data as CreditItem);
}

export async function getCreditItems(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<CreditItem[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as CreditItem[]);
}

export const creditFundingModule: ModuleContract = {
  manifest,
  getMetrics: (userId) => getMetrics(createClient(), userId),
  getActions: (userId) => getActions(createClient(), userId),
  getDecisionContext: (userId) => getDecisionContext(createClient(), userId),
  getHealth: (userId) => getHealth(createClient(), userId),
  syncToSpine: async (userId) => {
    const supabase = createClient();
    const metrics = await getMetrics(supabase, userId);
    await syncModuleMetricsToSpine(userId, manifest.id, metrics);
    await emitSystemEvent(supabase, userId, {
      event_name: 'module.synced',
      event_type: 'synced',
      module_id: manifest.id,
      payload: {},
    });
  },
};
