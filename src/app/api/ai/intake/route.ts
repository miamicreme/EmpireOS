import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { runIntake } from '@/spine/ai/intake.service';
import { intakeInputSchema } from '@/spine/ai/ai.schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/intake
 *
 * Submit one document; the agent decides which module it belongs to, extracts
 * its fields, saves it to `documents` (tagged to that module), and drafts the
 * next actions (pending approval).
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = intakeInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Paste a document to review.' });
  }

  try {
    const result = await runIntake(supabase, auth.data, parsed.data);
    if (!result.ok) return jsonResult(result);
    return jsonOk({
      output: result.data.output,
      documentId: result.data.documentId,
      drafts: result.data.drafts,
    });
  } catch (e) {
    return jsonError(appError('internal', `Intake failed: ${(e as Error).message}`));
  }
}
