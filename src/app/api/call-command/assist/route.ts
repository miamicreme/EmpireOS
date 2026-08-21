import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { ok } from '@/lib/result';
import { callAssistRequestSchema } from '@/modules/call-command/schemas';
import { runCallAssist } from '@/modules/call-command/service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/call-command/assist — { input, stage, intent, history,
 * recentLowConfidenceCount } -> a structured, spoken-language suggestion for the
 * operator. Stateless: no call content is persisted server-side.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = await readJson(request);
  const parsed = callAssistRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(appError('validation', 'Invalid call assist request.', parsed.error.format()));
  }

  try {
    const result = await runCallAssist(parsed.data);
    return jsonResult(ok(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Call assist failed.';
    return jsonError(appError('ai_provider_error', message));
  }
}
