/**
 * Projects module. Owns projects table; surfaces project metrics,
 * actions, and a decision context to the Spine via the ModuleContract.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import type { ModuleContract } from '@/spine/module-contract';
import type { Project } from '@/spine/types';
import { emitSystemEvent } from '@/spine/events/event.service';
import { syncModuleMetricsToSpine } from '@/spine/module-adapter';
import { manifest } from './manifest';
import { getMetrics, getHealth } from './metrics';
import { getActions } from './actions';
import { getDecisionContext } from './decisions';
import { createProjectSchema, updateProjectSchema } from './schemas';
import type { CreateProjectInput, UpdateProjectInput } from './schemas';

const TABLE = 'projects';

export async function createProject(
  supabase: SupabaseClient,
  userId: string,
  input: CreateProjectInput,
): Promise<AppResult<Project>> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid project.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));

  await emitSystemEvent(supabase, userId, {
    event_name: 'projects.project.created',
    event_type: 'created',
    module_id: manifest.id,
    entity_type: 'project',
    entity_id: (data as Project).id,
    payload: { name: (data as Project).name },
  });

  return ok(data as Project);
}

export async function updateProject(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateProjectInput,
): Promise<AppResult<Project>> {
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid project update.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Project not found.'));
  return ok(data as Project);
}

export async function getProjects(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<Project[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as Project[]);
}

export const projectsModule: ModuleContract = {
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
