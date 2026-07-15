import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';

export type JarvisRunStatus =
  | 'understanding'
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'needs_input'
  | 'failed'
  | 'cancelled';

export interface JarvisRunRow {
  id: string;
  user_id: string;
  trace_id: string;
  conversation_id: string | null;
  status: JarvisRunStatus;
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

export async function createJarvisRun(
  supabase: SupabaseClient,
  input: {
    id: string;
    userId: string;
    traceId: string;
    conversationId?: string;
    status: JarvisRunStatus;
    intent: string;
    requestSummary: string;
  },
): Promise<AppResult<JarvisRunRow>> {
  const { data, error } = await supabase
    .from('jarvis_runs')
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
  return ok(data as JarvisRunRow);
}

export async function updateJarvisRun(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  patch: Partial<Pick<JarvisRunRow,
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
): Promise<AppResult<JarvisRunRow>> {
  const { data, error } = await supabase
    .from('jarvis_runs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Jarvis run not found.'));
  return ok(data as JarvisRunRow);
}

export async function getJarvisRun(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
): Promise<AppResult<JarvisRunRow>> {
  const { data, error } = await supabase
    .from('jarvis_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Jarvis run not found.'));
  return ok(data as JarvisRunRow);
}

export async function requestJarvisRunCancellation(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
): Promise<AppResult<JarvisRunRow>> {
  const current = await getJarvisRun(supabase, userId, runId);
  if (!current.ok) return current;
  if (['completed', 'failed', 'cancelled', 'needs_input'].includes(current.data.status)) {
    return err(appError('invalid_state', `Cannot cancel a ${current.data.status} Jarvis run.`));
  }

  const now = new Date().toISOString();
  return updateJarvisRun(supabase, userId, runId, {
    status: 'cancelled',
    cancel_requested_at: now,
    completed_at: now,
    response_message: 'This Jarvis run was cancelled.',
  });
}
