/**
 * High-Income Job Hunt module. Owns job_applications.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import type { ModuleContract } from '@/spine/module-contract';
import type { JobApplication } from '@/spine/types';
import {
  createJobApplicationSchema,
  updateJobApplicationSchema,
  type CreateJobApplicationInput,
  type UpdateJobApplicationInput,
} from '@/spine/schemas';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';
import { getMetrics, getHealth } from './metrics';
import { getActions } from './actions';
import { getDecisionContext } from './decisions';

const TABLE = 'job_applications';

export async function createJobApplication(
  supabase: SupabaseClient,
  userId: string,
  input: CreateJobApplicationInput,
): Promise<AppResult<JobApplication>> {
  const parsed = createJobApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid job application.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));

  await emitSystemEvent(supabase, userId, {
    event_name: 'job.application.created',
    event_type: 'created',
    module_id: manifest.id,
    entity_type: 'job_application',
    entity_id: (data as JobApplication).id,
    payload: {},
  });

  return ok(data as JobApplication);
}

export async function getJobApplications(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<JobApplication[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as JobApplication[]);
}

export async function updateJobApplication(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateJobApplicationInput,
): Promise<AppResult<JobApplication>> {
  const parsed = updateJobApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid job application update.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Job application not found.'));
  return ok(data as JobApplication);
}

export async function deleteJobApplication(
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

export const jobHuntModule: ModuleContract = {
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
