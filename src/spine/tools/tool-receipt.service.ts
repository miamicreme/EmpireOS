import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { hashOperationInput, hashOperationOutput } from './tool-hash';
import type { AnyToolDefinition, ToolReceipt } from './tool.types';

export async function startToolReceipt(
  supabase: SupabaseClient,
  userId: string,
  traceId: string,
  runId: string | undefined,
  approvalId: string | undefined,
  tool: AnyToolDefinition,
  input: unknown,
  startedAt: string,
): Promise<AppResult<string>> {
  const { data, error } = await supabase
    .from('tool_run_receipts')
    .insert({
      user_id: userId,
      trace_id: traceId,
      run_id: runId ?? null,
      approval_id: approvalId ?? null,
      tool_id: tool.id,
      tool_version: tool.version,
      module_id: tool.moduleId,
      input_hash: hashOperationInput(input),
      status: 'started',
      started_at: startedAt,
      safe_metadata: {
        riskLevel: tool.riskLevel,
        sideEffect: tool.sideEffect,
        approvalPolicy: tool.approvalPolicy,
      },
    })
    .select('id')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(String(data.id));
}

export async function finishToolReceipt(
  supabase: SupabaseClient,
  userId: string,
  receiptId: string,
  receipt: ToolReceipt<unknown>,
): Promise<AppResult<void>> {
  const { error } = await supabase
    .from('tool_run_receipts')
    .update({
      status: receipt.status,
      output_hash: hashOperationOutput(receipt.output),
      duration_ms: receipt.durationMs,
      completed_at: receipt.completedAt,
    })
    .eq('id', receiptId)
    .eq('user_id', userId);
  if (error) return err(appError('db_error', error.message));
  return ok(undefined);
}

export async function failToolReceipt(
  supabase: SupabaseClient,
  userId: string,
  receiptId: string,
  status: 'failed' | 'timed_out',
  errorCode: string,
  durationMs: number,
): Promise<AppResult<void>> {
  const { error } = await supabase
    .from('tool_run_receipts')
    .update({
      status,
      error_code: errorCode,
      duration_ms: durationMs,
      completed_at: new Date().toISOString(),
    })
    .eq('id', receiptId)
    .eq('user_id', userId);
  if (error) return err(appError('db_error', error.message));
  return ok(undefined);
}
