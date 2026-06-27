/**
 * Acquisitions module. Owns acquisition_targets; surfaces metrics,
 * actions, and a decision context to the Spine via the ModuleContract.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import type { ModuleContract } from '@/spine/module-contract';
import type { AcquisitionTarget } from '@/spine/types';
import { emitSystemEvent } from '@/spine/events/event.service';
import { syncModuleMetricsToSpine } from '@/spine/module-adapter';
import { manifest } from './manifest';
import { getMetrics, getHealth } from './metrics';
import { getActions } from './actions';
import { getDecisionContext } from './decisions';
import { createAcquisitionTargetSchema, updateAcquisitionTargetSchema } from './schemas';
import type { CreateAcquisitionTargetInput, UpdateAcquisitionTargetInput } from './schemas';

const TABLE = 'acquisition_targets';

export async function createAcquisitionTarget(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAcquisitionTargetInput,
): Promise<AppResult<AcquisitionTarget>> {
  const parsed = createAcquisitionTargetSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid acquisition target.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));

  await emitSystemEvent(supabase, userId, {
    event_name: 'acquisitions.target.created',
    event_type: 'created',
    module_id: manifest.id,
    entity_type: 'acquisition_target',
    entity_id: (data as AcquisitionTarget).id,
    payload: { name: (data as AcquisitionTarget).name },
  });

  return ok(data as AcquisitionTarget);
}

export async function updateAcquisitionTarget(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateAcquisitionTargetInput,
): Promise<AppResult<AcquisitionTarget>> {
  const parsed = updateAcquisitionTargetSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid acquisition target update.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Acquisition target not found.'));
  return ok(data as AcquisitionTarget);
}

export async function getAcquisitionTargets(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<AcquisitionTarget[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as AcquisitionTarget[]);
}

export const acquisitionsModule: ModuleContract = {
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
