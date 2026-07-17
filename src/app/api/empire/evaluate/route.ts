import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk } from '@/lib/api';
import { runEmpireIntelligenceBenchmark } from '@/spine/empire/intelligence-evaluation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/empire/evaluate
 *
 * Runs the versioned Empire intelligence benchmark against the currently
 * configured provider chain. This intentionally consumes model requests and
 * persists each benchmark interaction as an owner-scoped Empire run.
 */
export async function POST() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const result = await runEmpireIntelligenceBenchmark(supabase, auth.data);
  return jsonOk(result);
}
