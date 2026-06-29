/**
 * AI Action Drafts — the "money feature".
 *
 * AI proposes actions here; they are NOT real global_actions until the user
 * approves. Approval is the only path that writes to the Spine, satisfying the
 * V2 safety rule: AI can recommend and draft, the user approves before any
 * action enters the execution layer.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { nowISO } from '@/lib/dates';
import { redactSensitiveText } from '../decisions/context-redaction.service';
import { createAction } from '../actions/action.service';
import { createGlobalActionSchema } from '../schemas';
import { MODULE_IDS } from '../constants';
import type { GlobalAction, ActionCategory, ActionPriority } from '../types';
import type { SuggestedAction, ActionDraftStatus } from './ai.types';

const TABLE = 'ai_action_drafts';

/**
 * Coerce an AI-provided module id to a known module or null. `module_id` is an
 * FK to public.modules, so a hallucinated id (or the literal "null") would fail
 * the whole batch insert — drop it to null instead.
 */
function normalizeModuleId(id: string | null | undefined): string | null {
  return id && (MODULE_IDS as readonly string[]).includes(id) ? id : null;
}

const VALID_CATEGORIES: ActionCategory[] = [
  'cash', 'job', 'followup', 'credit', 'project', 'acquisition', 'review', 'admin', 'general',
];
const VALID_PRIORITIES: ActionPriority[] = ['low', 'medium', 'high', 'critical'];

export interface ActionDraft {
  id: string;
  user_id: string;
  recommendation_id: string | null;
  module_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  due_at: string | null;
  impact_score: number;
  urgency_score: number;
  effort_score: number;
  confidence_score: number;
  status: ActionDraftStatus;
  approved_at: string | null;
  rejected_at: string | null;
  created_action_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function normalizeCategory(c: string): ActionCategory {
  return (VALID_CATEGORIES as string[]).includes(c) ? (c as ActionCategory) : 'general';
}
function normalizePriority(p: string): ActionPriority {
  return (VALID_PRIORITIES as string[]).includes(p) ? (p as ActionPriority) : 'medium';
}

/** Persist a batch of AI-suggested actions as pending drafts. */
export async function createDraftsFromSuggestions(
  supabase: SupabaseClient,
  userId: string,
  suggestions: SuggestedAction[],
  opts: { recommendationId?: string | null; moduleId?: string | null } = {},
): Promise<AppResult<ActionDraft[]>> {
  if (suggestions.length === 0) return ok([]);

  const rows = suggestions.map((s) => ({
    user_id: userId,
    recommendation_id: opts.recommendationId ?? null,
    module_id: normalizeModuleId(s.moduleId ?? opts.moduleId),
    title: redactSensitiveText(s.title).slice(0, 300),
    description: s.description ? redactSensitiveText(s.description).slice(0, 5000) : null,
    category: normalizeCategory(s.category),
    priority: normalizePriority(s.priority),
    impact_score: s.impactScore ?? 5,
    urgency_score: s.urgencyScore ?? 5,
    effort_score: s.effortScore ?? 5,
    confidence_score: s.confidenceScore ?? 0.5,
    status: 'pending' as const,
  }));

  const { data, error } = await supabase.from(TABLE).insert(rows).select('*');
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as ActionDraft[]);
}

export async function getActionDrafts(
  supabase: SupabaseClient,
  userId: string,
  status?: ActionDraftStatus,
): Promise<AppResult<ActionDraft[]>> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as ActionDraft[]);
}

export async function getActionDraftById(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<ActionDraft>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Action draft not found.'));
  return ok(data as ActionDraft);
}

/**
 * Approve a draft: create the real global_action and mark the draft approved.
 * Idempotent — re-approving an already-approved draft returns its existing
 * created action rather than duplicating.
 */
export async function approveActionDraft(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<{ draft: ActionDraft; action: GlobalAction }>> {
  const current = await getActionDraftById(supabase, userId, id);
  if (!current.ok) return current;
  const draft = current.data;

  if (draft.status === 'rejected') {
    return err(appError('invalid_state', 'Cannot approve a rejected draft.'));
  }
  if (draft.status === 'approved' && draft.created_action_id) {
    const existing = await supabase
      .from('global_actions')
      .select('*')
      .eq('id', draft.created_action_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing.data) {
      return ok({ draft, action: existing.data as GlobalAction });
    }
  }

  // Atomically claim the draft: flip pending -> approved guarded by status.
  // Only one concurrent caller wins, so a double-click / retry can't create two
  // global_actions. The loser falls through to read the winner's action.
  const { data: claimed, error: claimError } = await supabase
    .from(TABLE)
    .update({ status: 'approved', approved_at: nowISO() })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (claimError) return err(appError('db_error', claimError.message));
  if (!claimed) {
    // Someone else already claimed it (or it isn't pending). Return the existing
    // action if it's been recorded; otherwise report the in-flight conflict.
    const reread = await getActionDraftById(supabase, userId, id);
    if (!reread.ok) return reread;
    if (reread.data.status === 'approved' && reread.data.created_action_id) {
      const existing = await supabase
        .from('global_actions')
        .select('*')
        .eq('id', reread.data.created_action_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (existing.data) {
        return ok({ draft: reread.data, action: existing.data as GlobalAction });
      }
    }
    return err(appError('conflict', 'Draft approval already in progress.'));
  }

  const input = createGlobalActionSchema.parse({
    module_id: normalizeModuleId(claimed.module_id),
    title: claimed.title,
    description: claimed.description,
    category: normalizeCategory(claimed.category),
    priority: normalizePriority(claimed.priority),
    due_at: claimed.due_at,
    impact_score: claimed.impact_score,
    urgency_score: claimed.urgency_score,
    effort_score: claimed.effort_score,
    confidence_score: claimed.confidence_score,
    source_type: 'ai_draft',
    source_id: claimed.id,
  });

  const created = await createAction(supabase, userId, input);
  if (!created.ok) {
    // Release the claim so the user can retry after a transient create failure.
    await supabase
      .from(TABLE)
      .update({ status: 'pending', approved_at: null })
      .eq('id', id)
      .eq('user_id', userId);
    return created;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ created_action_id: created.data.id })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok({ draft: data as ActionDraft, action: created.data });
}

export async function rejectActionDraft(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<ActionDraft>> {
  const current = await getActionDraftById(supabase, userId, id);
  if (!current.ok) return current;
  if (current.data.status === 'approved') {
    return err(appError('invalid_state', 'Cannot reject an approved draft.'));
  }

  // Guard by status='pending' so a reject racing an in-flight approval can't
  // overwrite a draft the approval already claimed (which would otherwise leave
  // a real global_action attached to a "rejected" draft).
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'rejected', rejected_at: nowISO() })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!data) {
    // Lost the race: the draft is no longer pending (approval claimed it first).
    return err(appError('invalid_state', 'Draft is no longer pending.'));
  }
  return ok(data as ActionDraft);
}
