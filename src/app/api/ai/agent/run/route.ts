import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { runAgent } from '@/spine/ai/agent/agent-orchestrator.service';
import { agentRunInputSchema } from '@/spine/ai/agent/agent.schemas';
import { findRunByIdempotency } from '@/spine/ai/agent/agent-repository.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/agent/run — the single command path for the whole AI runtime.
 *
 * Body: { command, modeHint?, moduleHint?, artifactTypeHint?, runtimePreference?,
 *         threadId?, idempotency?, useResearch?, goDeeper? }
 * Returns the orchestrated AgentRunOutput (answer, drafts, gates, provider summary).
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = agentRunInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Invalid agent run input.' });
  }

  return jsonResult(await runAgent(supabase, auth.data, parsed.data));
}

/** GET /api/ai/agent/run?idempotency=... — lightweight run status lookup. */
export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const url = new URL(request.url);
  const idempotency = url.searchParams.get('idempotency');
  if (!idempotency) {
    return jsonError(appError('validation', 'idempotency is required.'));
  }

  const run = await findRunByIdempotency(supabase, auth.data, idempotency);
  return jsonOk({
    run: run
      ? {
          id: run.id,
          status: run.status,
          intent: run.intent,
          finalSummary: run.final_summary,
          confidence: run.confidence,
          riskLevel: run.risk_level,
          createdAt: run.created_at,
          completedAt: run.completed_at,
        }
      : null,
  });
}
