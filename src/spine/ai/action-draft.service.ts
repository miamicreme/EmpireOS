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
import type { GlobalAction, ActionCategory, ActionPriority } from '../types';
import type { SuggestedAction, ActionDraftStatus } from './ai.types';

const TABLE = 'ai_action_drafts';

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
    module_id: s.moduleId ?? opts.moduleId ?? null,
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

  const input = createGlobalActionSchema.parse({
    module_id: draft.module_id,
    title: draft.title,
    description: draft.description,
    category: normalizeCategory(draft.category),
    priority: normalizePriority(draft.priority),
    due_at: draft.due_at,
    impact_score: draft.impact_score,
    urgency_score: draft.urgency_score,
    effort_score: draft.effort_score,
    confidence_score: draft.confidence_score,
    source_type: 'ai_draft',
    source_id: draft.id,
  });

  const created = await createAction(supabase, userId, input);
  if (!created.ok) return created;

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'approved',
      approved_at: nowISO(),
      created_action_id: created.data.id,
    })
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

  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'rejected', rejected_at: nowISO() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as ActionDraft);
}
