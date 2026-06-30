/**
 * Action draft approval — the only path from an agent draft to a real Spine
 * action. Uses the same atomic status-guarded claim as V2 so concurrent
 * approvals can't double-create. Approved drafts become global_actions.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { nowISO } from '@/lib/dates';
import { createAction } from '../../actions/action.service';
import { createGlobalActionSchema } from '../../schemas';
import { MODULE_IDS } from '../../constants';
import type { GlobalAction, ActionCategory, ActionPriority } from '../../types';
import { getActionDraftById, type AgentActionDraftRow } from './agent-repository.service';

const TABLE = 'agent_action_drafts';
const VALID_CATEGORIES: ActionCategory[] = [
  'cash', 'job', 'followup', 'credit', 'project', 'acquisition', 'review', 'admin', 'general',
];
const VALID_PRIORITIES: ActionPriority[] = ['low', 'medium', 'high', 'critical'];

function normalizeModuleId(id: string | null | undefined): string | null {
  return id && (MODULE_IDS as readonly string[]).includes(id) ? id : null;
}
function normalizeCategory(c: string): ActionCategory {
  return (VALID_CATEGORIES as string[]).includes(c) ? (c as ActionCategory) : 'general';
}
function normalizePriority(p: string): ActionPriority {
  return (VALID_PRIORITIES as string[]).includes(p) ? (p as ActionPriority) : 'medium';
}

export interface DraftEdits {
  title?: string;
  description?: string | null;
  category?: string;
  priority?: string;
}

export async function approveAgentDraft(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  edits?: DraftEdits,
): Promise<AppResult<{ draft: AgentActionDraftRow; action: GlobalAction }>> {
  const current = await getActionDraftById(supabase, userId, id);
  if (!current.ok) return current;
  const draft = current.data;

  if (draft.approval_status === 'rejected') {
    return err(appError('invalid_state', 'Cannot approve a rejected draft.'));
  }
  if (draft.approval_status === 'approved' && draft.created_action_id) {
    const existing = await supabase
      .from('global_actions')
      .select('*')
      .eq('id', draft.created_action_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing.data) return ok({ draft, action: existing.data as GlobalAction });
  }

  // Atomically claim the draft (pending -> approved) so only one caller wins.
  const { data: claimed, error: claimError } = await supabase
    .from(TABLE)
    .update({ approval_status: 'approved', approved_at: nowISO() })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('approval_status', 'pending')
    .select('*')
    .maybeSingle();

  if (claimError) return err(appError('db_error', claimError.message));
  if (!claimed) {
    const reread = await getActionDraftById(supabase, userId, id);
    if (reread.ok && reread.data.approval_status === 'approved' && reread.data.created_action_id) {
      const existing = await supabase
        .from('global_actions')
        .select('*')
        .eq('id', reread.data.created_action_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (existing.data) return ok({ draft: reread.data, action: existing.data as GlobalAction });
    }
    return err(appError('conflict', 'Draft approval already in progress.'));
  }

  const d = claimed as AgentActionDraftRow;
  const input = createGlobalActionSchema.parse({
    module_id: normalizeModuleId(d.module_id),
    title: edits?.title ?? d.title,
    description: edits?.description !== undefined ? edits.description : d.description,
    category: normalizeCategory(edits?.category ?? d.category),
    priority: normalizePriority(edits?.priority ?? d.priority),
    due_at: d.due_at,
    impact_score: d.impact_score,
    urgency_score: d.urgency_score,
    effort_score: d.effort_score,
    confidence_score: d.confidence_score,
    source_type: 'agent_draft',
    source_id: d.id,
  });

  const created = await createAction(supabase, userId, input);
  if (!created.ok) {
    // Release the claim so the user can retry after a transient failure.
    await supabase
      .from(TABLE)
      .update({ approval_status: 'pending', approved_at: null })
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
  return ok({ draft: data as AgentActionDraftRow, action: created.data });
}

export async function rejectAgentDraft(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<AgentActionDraftRow>> {
  const current = await getActionDraftById(supabase, userId, id);
  if (!current.ok) return current;
  if (current.data.approval_status === 'approved') {
    return err(appError('invalid_state', 'Cannot reject an approved draft.'));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update({ approval_status: 'rejected', rejected_at: nowISO() })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('approval_status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('invalid_state', 'Draft is no longer pending.'));
  return ok(data as AgentActionDraftRow);
}

export interface BatchApproveResult {
  approved: Array<{ draftId: string; actionId: string }>;
  failed: Array<{ draftId: string; error: string }>;
}

export async function batchApproveDrafts(
  supabase: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<AppResult<BatchApproveResult>> {
  const result: BatchApproveResult = { approved: [], failed: [] };
  for (const id of ids) {
    const r = await approveAgentDraft(supabase, userId, id);
    if (r.ok) result.approved.push({ draftId: id, actionId: r.data.action.id });
    else result.failed.push({ draftId: id, error: r.error.message });
  }
  return ok(result);
}
