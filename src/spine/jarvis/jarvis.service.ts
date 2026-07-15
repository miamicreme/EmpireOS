import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { executeTool } from '@/spine/tools/tool-executor';

export const jarvisRunSchema = z.object({
  message: z.string().trim().min(1).max(8000),
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

function detectIntent(input: JarvisRunInput): JarvisRunResult['intent'] {
  const message = input.message.toLowerCase();
  if (input.recordingId || /transcrib|recording|interview audio/.test(message)) return 'transcribe_recording';
  if (/focus|today|priority|priorities|what matters|highest[- ]leverage/.test(message)) return 'daily_context';
  return 'unsupported';
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

  if (intent === 'unsupported') {
    return ok({
      runId,
      traceId,
      status: 'needs_input',
      intent,
      message: 'I can currently inspect today’s Spine context or transcribe a saved recording through governed tools.',
      operations: [],
      nextBestQuestion: 'Should I review today’s priorities or transcribe a recording?',
    });
  }

  if (intent === 'transcribe_recording' && !parsed.data.recordingId) {
    return ok({
      runId,
      traceId,
      status: 'needs_input',
      intent,
      message: 'I need the saved recording ID before I can transcribe it.',
      operations: [],
      nextBestQuestion: 'Which recording should I transcribe?',
    });
  }

  const toolId = intent === 'daily_context' ? 'spine.get_daily_context' : 'recorder.transcribe';
  const toolInput =
    intent === 'daily_context'
      ? { actionLimit: parsed.data.actionLimit ?? 5 }
      : { recordingId: parsed.data.recordingId };

  const executed = await executeTool(
    toolId,
    { supabase, userId, traceId, runId },
    toolInput,
  );
  if (!executed.ok) return executed;

  const receipt = executed.data;
  const responseMessage =
    intent === 'daily_context'
      ? 'I reviewed the Spine and returned the highest-priority actions plus module health.'
      : 'I transcribed the recording and verified the saved transcript.';

  return ok({
    runId,
    traceId,
    status: 'completed',
    intent,
    message: responseMessage,
    operations: [
      {
        toolId: receipt.toolId,
        receiptId: receipt.receiptId,
        status: receipt.status,
        durationMs: receipt.durationMs,
      },
    ],
    data: receipt.output,
  });
}
