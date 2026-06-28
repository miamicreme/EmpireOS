import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { runFullDecisionAnalysis } from '@/spine/decisions/decision-orchestrator.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/decisions/:id/analyze
 *
 * Kicks off the full advisor panel analysis for a decision:
 * 1. Builds and redacts context
 * 2. Runs 5 advisors in parallel
 * 3. Synthesizes with the Final Judge
 * 4. Finalizes the decision record
 *
 * Long-running (5–30s with a real provider). Clients should treat this as
 * an async trigger and poll GET /api/decisions/:id for status changes.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const result = await runFullDecisionAnalysis(supabase, auth.data, params.id);
  return jsonResult(result, 200);
}
