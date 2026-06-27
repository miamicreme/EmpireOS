/**
 * Global Action service.
 *
 * Every service function takes a server Supabase client (RLS-enforcing) and the
 * authenticated user id. Validation runs before writes; rank_score is computed
 * in the service layer, never trusted from the client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { nowISO } from '@/lib/dates';
import { computeRankScore, sortByRank } from '../action-ranking.service';
import {
  createGlobalActionSchema,
  updateGlobalActionSchema,
  type CreateGlobalActionInput,
  type UpdateGlobalActionInput,
} from '../schemas';
import type { GlobalAction } from '../types';

const TABLE = 'global_actions';

export async function createAction(
  supabase: SupabaseClient,
  userId: string,
  input: CreateGlobalActionInput,
): Promise<AppResult<GlobalAction>> {
  const parsed = createGlobalActionSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid action input.', parsed.error.format()));
  }
  const v = parsed.data;
  const rank_score = computeRankScore(v);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...v, user_id: userId, rank_score })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as GlobalAction);
}

export async function updateAction(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateGlobalActionInput,
): Promise<AppResult<GlobalAction>> {
  const parsed = updateGlobalActionSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid action update.', parsed.error.format()));
  }

  // Recompute rank if any scoring field is present in the update.
  const v = parsed.data;
  const patch: Record<string, unknown> = { ...v };
  if (
    v.impact_score !== undefined ||
    v.urgency_score !== undefined ||
    v.effort_score !== undefined ||
    v.confidence_score !== undefined ||
    v.empire_score_weight !== undefined
  ) {
    const current = await getActionById(supabase, userId, id);
    if (!current.ok) return current;
    patch.rank_score = computeRankScore({
      impact_score: v.impact_score ?? current.data.impact_score,
      urgency_score: v.urgency_score ?? current.data.urgency_score,
      effort_score: v.effort_score ?? current.data.effort_score,
      confidence_score: v.confidence_score ?? current.data.confidence_score,
      empire_score_weight:
        v.empire_score_weight ?? current.data.empire_score_weight,
    });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Action not found.'));
  return ok(data as GlobalAction);
}

export async function completeAction(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<GlobalAction>> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'done', completed_at: nowISO() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Action not found.'));
  return ok(data as GlobalAction);
}

export async function getActionById(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<GlobalAction>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Action not found.'));
  return ok(data as GlobalAction);
}

export async function getOpenActions(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<GlobalAction[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .in('status', ['open', 'in_progress', 'blocked'])
    .order('rank_score', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as GlobalAction[]);
}

export async function getRankedActions(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<GlobalAction[]>> {
  const open = await getOpenActions(supabase, userId);
  if (!open.ok) return open;
  return ok(sortByRank(open.data));
}

export async function getActionsByModule(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
): Promise<AppResult<GlobalAction[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .in('status', ['open', 'in_progress', 'blocked'])
    .order('rank_score', { ascending: false });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as GlobalAction[]);
}
