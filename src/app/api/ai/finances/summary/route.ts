import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult } from '@/lib/api';
import { appError } from '@/lib/errors';
import { runFinanceSummary } from '@/spine/ai/finance-summary.service';

export const dynamic = 'force-dynamic';

/** POST generates the AI "state of your finances" brief from the snapshot. */
export async function POST() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  try {
    const result = await runFinanceSummary(supabase, auth.data);
    if (!result.ok) return jsonResult(result);
    return jsonOk({ output: result.data.output, insights: result.data.insights });
  } catch (e) {
    return jsonError(appError('internal', `Finance summary failed: ${(e as Error).message}`));
  }
}
