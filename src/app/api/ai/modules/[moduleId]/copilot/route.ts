import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { runModuleCopilot } from '@/spine/ai/module-copilot.service';
import { moduleCopilotInputSchema } from '@/spine/ai/ai.schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/modules/:moduleId/copilot
 *
 * Runs the module-specific AI copilot. Returns recommendations + drafted
 * actions (pending approval). Unknown module ids return a 422.
 */
export async function POST(
  request: Request,
  { params }: { params: { moduleId: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = moduleCopilotInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Invalid copilot input.' });
  }

  try {
    const result = await runModuleCopilot(supabase, auth.data, params.moduleId, {
      question: parsed.data.question,
      persist: parsed.data.persist,
    });
    if (!result.ok) return jsonResult(result);

    return jsonOk({ output: result.data.output, drafts: result.data.drafts });
  } catch (e) {
    return jsonError(appError('internal', `Module copilot failed: ${(e as Error).message}`));
  }
}
