import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { runEmpireCommand, empireRunSchema } from '@/spine/empire/empire.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/empire/runs
 *
 * Authoritative Empire command path. It accepts natural-language intent,
 * selects only registered tools, executes through the governed Tool Gateway,
 * and returns operation receipts instead of vague success claims.
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

  const result = await runEmpireCommand(supabase, auth.data, parsed.data);
  return result.ok ? jsonResult(result) : jsonError(result.error);
}
