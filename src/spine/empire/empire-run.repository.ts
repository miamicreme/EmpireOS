import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';

export type EmpireRunStatus =
  | 'understanding'
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'needs_input'
  | 'failed'
  | 'cancelled';

export interface EmpireRunRow {
  id: string;
  user_id: string;
  trace_id: string;
  conversation_id: string | null;
  status: EmpireRunStatus;
  intent: string;
  request_summary: string;
  response_message: string | null;
  next_best_question: string | null;
  operation_receipt_ids: string[];
  safe_result: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  cancel_requested_at: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createEmpireRun(
  supabase: SupabaseClient,
  input: {
    id: string;
    userId: string;
    traceId: string;
    conversationId?: string;
    status: EmpireRunStatus;
    intent: string;
    requestSummary: string;
  },
): Promise<AppResult<EmpireRunRow>> {
  const { data, error } = await supabase
    .from('empire_runs')
    .insert({
      id: input.id,
      user_id: input.userId,
      trace_id: input.traceId,
      conversation_id: input.conversationId ?? null,
      status: input.status,
      intent: input.intent,
      request_summary: input.requestSummary.slice(0, 500),
    })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as EmpireRunRow);
}

export async function updateEmpireRun(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  patch: Partial<Pick<EmpireRunRow,
    | 'status'
    | 'intent'
    | 'response_message'
    | 'next_best_question'
    | 'operation_receipt_ids'
    | 'safe_result'
    | 'error_code'
    | 'error_message'
    | 'cancel_requested_at'
    | 'completed_at'
  >>,
): Promise<AppResult<EmpireRunRow>> {
  const { data, error } = await supabase
    .from('empire_runs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Empire run not found.'));
  return ok(data as EmpireRunRow);
}

export async function getEmpireRun(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
): Promise<AppResult<EmpireRunRow>> {
  const { data, error } = await supabase
    .from('empire_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Empire run not found.'));
  return ok(data as EmpireRunRow);
}

export async function requestEmpireRunCancellation(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
): Promise<AppResult<EmpireRunRow>> {
  const current = await getEmpireRun(supabase, userId, runId);
  if (!current.ok) return current;
  if (['completed', 'failed', 'cancelled', 'needs_input'].includes(current.data.status)) {
    return err(appError('invalid_state', `Cannot cancel a ${current.data.status} Empire run.`));
  }

  const now = new Date().toISOString();
  return updateEmpireRun(supabase, userId, runId, {
    status: 'cancelled',
    cancel_requested_at: now,
    completed_at: now,
    response_message: 'This Empire run was cancelled.',
  });
}
