import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { executeTool } from '@/spine/tools/tool-executor';
import { createToolApproval } from '@/spine/tools/approval.service';
import { getTool } from '@/spine/tools/tool-registry';
import {
  createEmpireRun,
  getEmpireRun,
  updateEmpireRun,
  type EmpireRunStatus,
} from './empire-run.repository';

export const empireRunSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  conversationId: z.string().uuid().optional(),
  recordingId: z.string().uuid().optional(),
  actionDraftId: z.string().uuid().optional(),
  actionLimit: z.number().int().min(1).max(20).optional(),
});

export const continueEmpireRunSchema = z.object({
  approvalId: z.string().uuid(),
});

export type EmpireRunInput = z.infer<typeof empireRunSchema>;

export interface EmpireRunResult {
  runId: string;
  traceId: string;
  status: 'completed' | 'needs_input' | 'awaiting_approval' | 'failed';
  intent: 'daily_context' | 'transcribe_recording' | 'approve_action_draft' | 'unsupported';
  message: string;
  operations: Array<{
    toolId: string;
    receiptId: string;
    status: 'verified' | 'unverified';
    durationMs: number;
  }>;
  approval?: {
    id: string;
    summary: string;
    exactEffect: string;
    expiresAt: string;
  };
  data?: unknown;
  nextBestQuestion?: string;
}

type EmpireIntent = EmpireRunResult['intent'];

function detectIntent(input: EmpireRunInput): EmpireIntent {
  const message = input.message.toLowerCase();
  if (input.actionDraftId || /approve.*action|activate.*draft|create.*spine action/.test(message)) {
    return 'approve_action_draft';
  }
  if (input.recordingId || /transcrib|recording|interview audio/.test(message)) return 'transcribe_recording';
  if (/focus|today|priority|priorities|what matters|highest[- ]leverage/.test(message)) return 'daily_context';
  return 'unsupported';
}

function safeRequestSummary(intent: EmpireIntent): string {
  switch (intent) {
    case 'daily_context':
      return 'Owner requested current Spine priorities and module health.';
    case 'transcribe_recording':
      return 'Owner requested transcription of an owner-scoped saved recording.';
    case 'approve_action_draft':
      return 'Owner requested conversion of one AI action draft into a real Spine action.';
    default:
      return 'Owner request requires clarification or an unsupported capability.';
  }
}

async function completeToolRun(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  traceId: string,
  intent: EmpireIntent,
  toolId: string,
  toolInput: unknown,
  approvalId?: string,
): Promise<AppResult<EmpireRunResult>> {
  const executing = await updateEmpireRun(supabase, userId, runId, { status: 'executing' });
  if (!executing.ok) return executing;

  const executed = await executeTool(
    toolId,
    { supabase, userId, traceId, runId, approvalId },
    toolInput,
  );

  if (!executed.ok) {
    await updateEmpireRun(supabase, userId, runId, {
      status: 'failed',
      response_message: 'Empire could not complete the requested operation.',
      completed_at: new Date().toISOString(),
      error_code: executed.error.code,
      error_message: executed.error.message.slice(0, 1000),
    });
    return executed;
  }

  const verifying = await updateEmpireRun(supabase, userId, runId, { status: 'verifying' });
  if (!verifying.ok) return verifying;

  const receipt = executed.data;
  const responseMessage =
    intent === 'daily_context'
      ? 'I reviewed the Spine and returned the highest-priority actions plus module health.'
      : intent === 'transcribe_recording'
        ? 'I transcribed the recording and verified the saved transcript.'
        : 'I converted the approved draft into a verified Spine action.';

  const operations = [{
    toolId: receipt.toolId,
    receiptId: receipt.receiptId,
    status: receipt.status,
    durationMs: receipt.durationMs,
  }];

  const completed = await updateEmpireRun(supabase, userId, runId, {
    status: 'completed',
    response_message: responseMessage,
    completed_at: new Date().toISOString(),
    operation_receipt_ids: [receipt.receiptId],
    safe_result: {
      operationCount: 1,
      toolIds: [receipt.toolId],
      verification: receipt.status,
    },
  });
  if (!completed.ok) return completed;

  return ok({
    runId,
    traceId,
    status: 'completed',
    intent,
    message: responseMessage,
    operations,
    data: receipt.output,
  });
}

export async function runEmpireCommand(
  supabase: SupabaseClient,
  userId: string,
  input: EmpireRunInput,
): Promise<AppResult<EmpireRunResult>> {
  const parsed = empireRunSchema.safeParse(input);
  if (!parsed.success) return err(appError('validation', 'Invalid Empire request.', parsed.error.format()));

  const runId = randomUUID();
  const traceId = randomUUID();
  const intent = detectIntent(parsed.data);

  const created = await createEmpireRun(supabase, {
    id: runId,
    userId,
    traceId,
    conversationId: parsed.data.conversationId,
    status: 'understanding',
    intent,
    requestSummary: safeRequestSummary(intent),
  });
  if (!created.ok) return created;

  if (intent === 'unsupported') {
    const message = 'I can inspect today’s Spine context, transcribe a saved recording, or approve an action draft through governed tools.';
    const nextBestQuestion = 'Should I review priorities, transcribe a recording, or approve an action draft?';
    const updated = await updateEmpireRun(supabase, userId, runId, {
      status: 'needs_input',
      response_message: message,
      next_best_question: nextBestQuestion,
      completed_at: new Date().toISOString(),
    });
    if (!updated.ok) return updated;
    return ok({ runId, traceId, status: 'needs_input', intent, message, operations: [], nextBestQuestion });
  }

  if (intent === 'transcribe_recording' && !parsed.data.recordingId) {
    const message = 'I need the saved recording ID before I can transcribe it.';
    const nextBestQuestion = 'Which recording should I transcribe?';
    const updated = await updateEmpireRun(supabase, userId, runId, {
      status: 'needs_input', response_message: message, next_best_question: nextBestQuestion,
      completed_at: new Date().toISOString(),
    });
    if (!updated.ok) return updated;
    return ok({ runId, traceId, status: 'needs_input', intent, message, operations: [], nextBestQuestion });
  }

  if (intent === 'approve_action_draft' && !parsed.data.actionDraftId) {
    const message = 'I need the action draft ID before I can request approval.';
    const nextBestQuestion = 'Which action draft should become a real Spine action?';
    const updated = await updateEmpireRun(supabase, userId, runId, {
      status: 'needs_input', response_message: message, next_best_question: nextBestQuestion,
      completed_at: new Date().toISOString(),
    });
    if (!updated.ok) return updated;
    return ok({ runId, traceId, status: 'needs_input', intent, message, operations: [], nextBestQuestion });
  }

  const planning = await updateEmpireRun(supabase, userId, runId, { status: 'planning' });
  if (!planning.ok) return planning;

  const toolId =
    intent === 'daily_context'
      ? 'spine.get_daily_context'
      : intent === 'transcribe_recording'
        ? 'recorder.transcribe'
        : 'spine.approve_action_draft';
  const toolInput =
    intent === 'daily_context'
      ? { actionLimit: parsed.data.actionLimit ?? 5 }
      : intent === 'transcribe_recording'
        ? { recordingId: parsed.data.recordingId }
        : { actionDraftId: parsed.data.actionDraftId };

  const tool = getTool(toolId);
  if (!tool) return err(appError('tool_not_found', `Tool ${toolId} is not registered.`));

  if (tool.approvalPolicy !== 'none') {
    const approval = await createToolApproval(
      supabase,
      userId,
      traceId,
      tool,
      toolInput,
      'Approve one AI action draft',
      'Create one real Spine action from the exact selected draft. No email, calendar, financial, or external action will occur.',
      runId,
    );
    if (!approval.ok) return approval;

    const message = 'This write is ready, but I need your approval before creating the Spine action.';
    const updated = await updateEmpireRun(supabase, userId, runId, {
      status: 'awaiting_approval',
      response_message: message,
      safe_result: {
        pendingToolId: toolId,
        pendingInput: toolInput,
        approvalId: approval.data.id,
      },
    });
    if (!updated.ok) return updated;

    return ok({
      runId,
      traceId,
      status: 'awaiting_approval',
      intent,
      message,
      operations: [],
      approval: {
        id: approval.data.id,
        summary: approval.data.summary,
        exactEffect: approval.data.exact_effect,
        expiresAt: approval.data.expires_at,
      },
    });
  }

  return completeToolRun(supabase, userId, runId, traceId, intent, toolId, toolInput);
}

export async function continueEmpireRun(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  input: z.infer<typeof continueEmpireRunSchema>,
): Promise<AppResult<EmpireRunResult>> {
  const parsed = continueEmpireRunSchema.safeParse(input);
  if (!parsed.success) return err(appError('validation', 'Invalid Empire continuation.', parsed.error.format()));

  const run = await getEmpireRun(supabase, userId, runId);
  if (!run.ok) return run;
  if (run.data.status !== 'awaiting_approval') {
    return err(appError('invalid_state', 'Empire run is not awaiting approval.'));
  }

  const pendingToolId = run.data.safe_result.pendingToolId;
  const pendingInput = run.data.safe_result.pendingInput;
  const expectedApprovalId = run.data.safe_result.approvalId;
  if (
    typeof pendingToolId !== 'string' ||
    typeof expectedApprovalId !== 'string' ||
    expectedApprovalId !== parsed.data.approvalId ||
    !pendingInput ||
    typeof pendingInput !== 'object'
  ) {
    return err(appError('tool_not_allowed', 'Continuation does not match the pending approved operation.'));
  }

  return completeToolRun(
    supabase,
    userId,
    run.data.id,
    run.data.trace_id,
    run.data.intent as EmpireIntent,
    pendingToolId,
    pendingInput,
    parsed.data.approvalId,
  );
}
