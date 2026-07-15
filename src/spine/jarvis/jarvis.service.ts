import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { executeTool } from '@/spine/tools/tool-executor';
import {
  createJarvisRun,
  updateJarvisRun,
  type JarvisRunStatus,
} from './jarvis-run.repository';

export const jarvisRunSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  conversationId: z.string().uuid().optional(),
  recordingId: z.string().uuid().optional(),
  actionLimit: z.number().int().min(1).max(20).optional(),
});

export type JarvisRunInput = z.infer<typeof jarvisRunSchema>;

export interface JarvisRunResult {
  runId: string;
  traceId: string;
  status: 'completed' | 'needs_input' | 'failed';
  intent: 'daily_context' | 'transcribe_recording' | 'unsupported';
  message: string;
  operations: Array<{
    toolId: string;
    receiptId: string;
    status: 'verified' | 'unverified';
    durationMs: number;
  }>;
  data?: unknown;
  nextBestQuestion?: string;
}

type JarvisIntent = JarvisRunResult['intent'];

function detectIntent(input: JarvisRunInput): JarvisIntent {
  const message = input.message.toLowerCase();
  if (input.recordingId || /transcrib|recording|interview audio/.test(message)) return 'transcribe_recording';
  if (/focus|today|priority|priorities|what matters|highest[- ]leverage/.test(message)) return 'daily_context';
  return 'unsupported';
}

function safeRequestSummary(intent: JarvisIntent): string {
  switch (intent) {
    case 'daily_context':
      return 'Owner requested current Spine priorities and module health.';
    case 'transcribe_recording':
      return 'Owner requested transcription of an owner-scoped saved recording.';
    default:
      return 'Owner request requires clarification or an unsupported capability.';
  }
}

function terminalPatch(
  status: Extract<JarvisRunStatus, 'completed' | 'needs_input' | 'failed'>,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return {
    status,
    response_message: message,
    completed_at: new Date().toISOString(),
    ...extra,
  };
}

export async function runJarvisCommand(
  supabase: SupabaseClient,
  userId: string,
  input: JarvisRunInput,
): Promise<AppResult<JarvisRunResult>> {
  const parsed = jarvisRunSchema.safeParse(input);
  if (!parsed.success) return err(appError('validation', 'Invalid Jarvis request.', parsed.error.format()));

  const runId = randomUUID();
  const traceId = randomUUID();
  const intent = detectIntent(parsed.data);

  const created = await createJarvisRun(supabase, {
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
    const message = 'I can currently inspect today’s Spine context or transcribe a saved recording through governed tools.';
    const nextBestQuestion = 'Should I review today’s priorities or transcribe a recording?';
    const updated = await updateJarvisRun(
      supabase,
      userId,
      runId,
      terminalPatch('needs_input', message, { next_best_question: nextBestQuestion }),
    );
    if (!updated.ok) return updated;
    return ok({
      runId,
      traceId,
      status: 'needs_input',
      intent,
      message,
      operations: [],
      nextBestQuestion,
    });
  }

  if (intent === 'transcribe_recording' && !parsed.data.recordingId) {
    const message = 'I need the saved recording ID before I can transcribe it.';
    const nextBestQuestion = 'Which recording should I transcribe?';
    const updated = await updateJarvisRun(
      supabase,
      userId,
      runId,
      terminalPatch('needs_input', message, { next_best_question: nextBestQuestion }),
    );
    if (!updated.ok) return updated;
    return ok({
      runId,
      traceId,
      status: 'needs_input',
      intent,
      message,
      operations: [],
      nextBestQuestion,
    });
  }

  const planning = await updateJarvisRun(supabase, userId, runId, { status: 'planning' });
  if (!planning.ok) return planning;

  const toolId = intent === 'daily_context' ? 'spine.get_daily_context' : 'recorder.transcribe';
  const toolInput =
    intent === 'daily_context'
      ? { actionLimit: parsed.data.actionLimit ?? 5 }
      : { recordingId: parsed.data.recordingId };

  const executing = await updateJarvisRun(supabase, userId, runId, { status: 'executing' });
  if (!executing.ok) return executing;

  const executed = await executeTool(
    toolId,
    { supabase, userId, traceId, runId },
    toolInput,
  );

  if (!executed.ok) {
    await updateJarvisRun(
      supabase,
      userId,
      runId,
      terminalPatch('failed', 'Jarvis could not complete the requested operation.', {
        error_code: executed.error.code,
        error_message: executed.error.message.slice(0, 1000),
      }),
    );
    return executed;
  }

  const verifying = await updateJarvisRun(supabase, userId, runId, { status: 'verifying' });
  if (!verifying.ok) return verifying;

  const receipt = executed.data;
  const responseMessage =
    intent === 'daily_context'
      ? 'I reviewed the Spine and returned the highest-priority actions plus module health.'
      : 'I transcribed the recording and verified the saved transcript.';

  const operations = [
    {
      toolId: receipt.toolId,
      receiptId: receipt.receiptId,
      status: receipt.status,
      durationMs: receipt.durationMs,
    },
  ];

  const completed = await updateJarvisRun(
    supabase,
    userId,
    runId,
    terminalPatch('completed', responseMessage, {
      operation_receipt_ids: [receipt.receiptId],
      safe_result: {
        operationCount: 1,
        toolIds: [receipt.toolId],
        verification: receipt.status,
      },
    }),
  );
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
