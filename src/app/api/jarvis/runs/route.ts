import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { runJarvisCommand, jarvisRunSchema } from '@/spine/jarvis/jarvis.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jarvis/runs
 *
 * First authoritative Jarvis command path. It accepts natural-language intent,
 * selects only registered tools, executes through the governed Tool Gateway,
 * and returns operation receipts instead of vague success claims.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = await readJson(request);
  const parsed = jarvisRunSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError({
      code: 'validation',
      message: 'Invalid Jarvis request.',
      details: parsed.error.format(),
    });
  }

  const result = await runJarvisCommand(supabase, auth.data, parsed.data);
  return result.ok ? jsonResult(result) : jsonError(result.error);
}
