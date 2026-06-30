import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { runAgent } from '@/spine/ai/agent/agent-orchestrator.service';
import { agentRunInputSchema } from '@/spine/ai/agent/agent.schemas';

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
