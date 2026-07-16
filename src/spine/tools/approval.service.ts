import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { hashOperationInput } from './tool-hash';
import type { AnyToolDefinition } from './tool.types';

export interface ToolApprovalRequest {
  id: string;
  user_id: string;
  trace_id: string;
  run_id: string | null;
  tool_id: string;
  tool_version: string;
  input_hash: string;
  risk_level: string;
  approval_policy: string;
  summary: string;
  exact_effect: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'used';
  expires_at: string;
  approved_at: string | null;
  consumed_at: string | null;
  created_at: string;
}

export async function createToolApproval(
  supabase: SupabaseClient,
  userId: string,
  traceId: string,
  tool: AnyToolDefinition,
  input: unknown,
  summary: string,
  exactEffect: string,
  runId?: string,
): Promise<AppResult<ToolApprovalRequest>> {
  if (tool.approvalPolicy === 'none') {
    return err(appError('invalid_state', `Tool ${tool.id} does not require approval.`));
  }

  const inputHash = hashOperationInput(input);
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { data, error } = await supabase
    .from('tool_approval_requests')
    .insert({
      user_id: userId,
      trace_id: traceId,
      run_id: runId ?? null,
      tool_id: tool.id,
      tool_version: tool.version,
      input_hash: inputHash,
      risk_level: tool.riskLevel,
      approval_policy: tool.approvalPolicy,
      summary: summary.slice(0, 500),
      exact_effect: exactEffect.slice(0, 2000),
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as ToolApprovalRequest);
}

export async function approveToolApproval(
  supabase: SupabaseClient,
  userId: string,
  approvalId: string,
): Promise<AppResult<ToolApprovalRequest>> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('tool_approval_requests')
    .update({ status: 'approved', approved_at: now })
    .eq('id', approvalId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .select('*')
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('invalid_state', 'Approval is missing, expired, or no longer pending.'));
  return ok(data as ToolApprovalRequest);
}

export async function consumeToolApproval(
  supabase: SupabaseClient,
  userId: string,
  approvalId: string,
  tool: AnyToolDefinition,
  input: unknown,
): Promise<AppResult<ToolApprovalRequest>> {
  const now = new Date().toISOString();
  const inputHash = hashOperationInput(input);
  const { data, error } = await supabase
    .from('tool_approval_requests')
    .update({ status: 'used', consumed_at: now })
    .eq('id', approvalId)
    .eq('user_id', userId)
    .eq('tool_id', tool.id)
    .eq('tool_version', tool.version)
    .eq('input_hash', inputHash)
    .eq('status', 'approved')
    .gt('expires_at', now)
    .select('*')
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!data) {
    return err(
      appError('tool_not_allowed', 'Approval does not match this exact operation or has expired.'),
    );
  }
  return ok(data as ToolApprovalRequest);
}
