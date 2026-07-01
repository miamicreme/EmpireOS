import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { runFullDecisionAnalysis } from '@/spine/decisions/decision-orchestrator.service';
import { createActionsFromDecision } from '@/spine/decisions/decision.service';

export const dynamic = 'force-dynamic';

type AnalyzeBody = {
  createActions?: boolean;
};

function parseAnalyzeBody(input: unknown): AnalyzeBody {
  if (!input || typeof input !== 'object') return {};
  const record = input as Record<string, unknown>;
  return {
    createActions: record.createActions === true,
  };
}

/**
 * POST /api/decisions/:id/analyze
 *
 * Runs the full Empire OS decision pipeline:
 * 1. Build decision context
 * 2. Redact sensitive context
 * 3. Run advisor panel
 * 4. Run Final Judge
 * 5. Finalize the decision
 * 6. Optionally create global actions from advisor next_actions
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = parseAnalyzeBody(await readJson(request));
  try {
    const analysis = await runFullDecisionAnalysis(supabase, auth.data, params.id);
    if (!analysis.ok) return jsonResult(analysis);

    if (!body.createActions) {
      return jsonOk({
        analysis: analysis.data,
        actionsCreated: [],
      });
    }

    const actions = await createActionsFromDecision(supabase, auth.data, params.id);
    if (!actions.ok) return jsonResult(actions);

    return jsonOk({
      analysis: analysis.data,
      actionsCreated: actions.data,
    });
  } catch (e) {
    return jsonError(appError('internal', `Decision analysis failed: ${(e as Error).message}`));
  }
}
