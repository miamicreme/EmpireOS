import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { runEmpireCommand, empireRunSchema } from '@/spine/empire/empire.service';
import { runEmpireGeneralConversation } from '@/spine/empire/general-conversation.service';

export const dynamic = 'force-dynamic';

function isGovernedCommand(body: { message: string; recordingId?: string; actionDraftId?: string }): boolean {
  const message = body.message.toLowerCase();
  return Boolean(
    body.recordingId ||
      body.actionDraftId ||
      /approve.*action|activate.*draft|create.*spine action/.test(message) ||
      /transcrib|recording|interview audio/.test(message) ||
      /focus|today|priority|priorities|what matters|highest[- ]leverage/.test(message),
  );
}

/**
 * POST /api/empire/runs
 *
 * Authoritative Empire command path. Governed operational intents stay on the
 * Tool Gateway path. All other natural-language requests are delegated to the
 * broader AI runtime and persisted as Empire runs, without bypassing approvals.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = await readJson(request);
  const parsed = empireRunSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError({
      code: 'validation',
      message: 'Invalid Empire request.',
      details: parsed.error.format(),
    });
  }

  const result = isGovernedCommand(parsed.data)
    ? await runEmpireCommand(supabase, auth.data, parsed.data)
    : await runEmpireGeneralConversation(supabase, auth.data, {
        message: parsed.data.message,
        conversationId: parsed.data.conversationId,
      });

  return result.ok ? jsonResult(result) : jsonError(result.error);
}
