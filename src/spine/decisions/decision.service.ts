/**
 * Decision service. Manages decision records, options, and advisor votes, and
 * can spin off concrete global actions from a finalized decision.
 *
 * RLS protects options/votes through the parent decision's user_id, so writes
 * always verify ownership of the parent decision first.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { nowISO } from '@/lib/dates';
import { createAction } from '../actions/action.service';
import {
  createDecisionSchema,
  createDecisionOptionSchema,
  createDecisionVoteSchema,
  type CreateDecisionInput,
  type CreateDecisionOptionInput,
  type CreateDecisionVoteInput,
} from '../schemas';
import type {
  Decision,
  DecisionOption,
  DecisionVote,
  GlobalAction,
} from '../types';
import type { DecisionWithVotes } from './decision.types';

const DECISIONS = 'decisions';
const OPTIONS = 'decision_options';
const VOTES = 'decision_votes';

async function ownsDecision(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(DECISIONS)
    .select('id')
    .eq('id', decisionId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

export async function createDecision(
  supabase: SupabaseClient,
  userId: string,
  input: CreateDecisionInput,
): Promise<AppResult<Decision>> {
  const parsed = createDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid decision input.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(DECISIONS)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as Decision);
}

export async function addDecisionOption(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
  input: CreateDecisionOptionInput,
): Promise<AppResult<DecisionOption>> {
  const parsed = createDecisionOptionSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid option input.', parsed.error.format()));
  }
  if (!(await ownsDecision(supabase, userId, decisionId))) {
    return err(appError('forbidden', 'Decision not owned by user.'));
  }
  const { data, error } = await supabase
    .from(OPTIONS)
    .insert({ ...parsed.data, decision_id: decisionId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as DecisionOption);
}

export async function addAdvisorVote(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
  input: CreateDecisionVoteInput,
): Promise<AppResult<DecisionVote>> {
  const parsed = createDecisionVoteSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid vote input.', parsed.error.format()));
  }
  if (!(await ownsDecision(supabase, userId, decisionId))) {
    return err(appError('forbidden', 'Decision not owned by user.'));
  }
  const { data, error } = await supabase
    .from(VOTES)
    .insert({ ...parsed.data, decision_id: decisionId })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as DecisionVote);
}

export async function getDecisionWithVotes(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
): Promise<AppResult<DecisionWithVotes>> {
  const { data: decision, error: dErr } = await supabase
    .from(DECISIONS)
    .select('*')
    .eq('id', decisionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (dErr) return err(appError('db_error', dErr.message));
  if (!decision) return err(appError('not_found', 'Decision not found.'));

  const [{ data: options, error: oErr }, { data: votes, error: vErr }] =
    await Promise.all([
      supabase.from(OPTIONS).select('*').eq('decision_id', decisionId),
      supabase.from(VOTES).select('*').eq('decision_id', decisionId),
    ]);
  if (oErr) return err(appError('db_error', oErr.message));
  if (vErr) return err(appError('db_error', vErr.message));

  return ok({
    ...(decision as Decision),
    options: (options ?? []) as DecisionOption[],
    votes: (votes ?? []) as DecisionVote[],
  });
}

export async function finalizeDecision(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
  recommendation: string,
  meta?: { confidence?: number; risk_level?: string; upside_level?: string },
): Promise<AppResult<Decision>> {
  const { data, error } = await supabase
    .from(DECISIONS)
    .update({
      status: 'decided',
      recommendation,
      decided_at: nowISO(),
      ...(meta?.confidence !== undefined && { confidence: meta.confidence }),
      ...(meta?.risk_level !== undefined && { risk_level: meta.risk_level }),
      ...(meta?.upside_level !== undefined && { upside_level: meta.upside_level }),
    })
    .eq('id', decisionId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Decision not found.'));
  return ok(data as Decision);
}

/**
 * Creates global actions from a finalized decision's recommendation. Pulls
 * `next_actions` from advisor votes (deduped) and creates one action each.
 */
export async function createActionsFromDecision(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
): Promise<AppResult<GlobalAction[]>> {
  const full = await getDecisionWithVotes(supabase, userId, decisionId);
  if (!full.ok) return full;

  const titles = new Set<string>();
  for (const vote of full.data.votes) {
    const next = vote.next_actions;
    if (Array.isArray(next)) {
      for (const t of next) if (typeof t === 'string' && t.trim()) titles.add(t.trim());
    }
  }

  const created: GlobalAction[] = [];
  for (const title of titles) {
    const res = await createAction(supabase, userId, {
      title,
      category: 'general',
      status: 'open',
      priority: 'medium',
      source_type: 'decision',
      source_id: decisionId,
      impact_score: 6,
      urgency_score: 6,
      effort_score: 4,
      confidence_score: full.data.confidence ?? 0.5,
      empire_score_weight: 1,
      metadata: {},
    });
    if (res.ok) created.push(res.data);
  }

  return ok(created);
}
