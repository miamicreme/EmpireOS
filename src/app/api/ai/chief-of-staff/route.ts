import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { runChiefOfStaff } from '@/spine/ai/chief-of-staff.service';
import { askInputSchema } from '@/spine/ai/ai.schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/chief-of-staff
 *
 * Runs the AI Chief of Staff. With no body it produces the daily ranked plan.
 * With { question } it answers a specific decision (the AI Decision Console /
 * Ask Empire OS). Drafts the top actions into ai_action_drafts (pending
 * approval) when persist is true.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const raw = await readJson(request);
  // Body is optional; when present, validate the question shape.
  let question: string | undefined;
  let persist = true;
  if (raw && typeof raw === 'object' && 'question' in (raw as object)) {
    const parsed = askInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError({ code: 'validation', message: 'Invalid question input.' });
    }
    question = parsed.data.question;
    persist = parsed.data.persist;
  }

  try {
    const result = await runChiefOfStaff(supabase, auth.data, { question, persist });
    if (!result.ok) return jsonResult(result);

    return jsonOk({
      output: result.data.output,
      drafts: result.data.drafts,
      empireScore: result.data.context.empireScore,
      derived: result.data.context.derived,
      trends: result.data.context.trends
        .filter((t) => t.direction !== 'flat' && t.streakDays >= 2)
        .slice(0, 4),
    });
  } catch (e) {
    // A provider/network failure would otherwise throw uncaught, returning an
    // empty/HTML body the client can't parse ("Unexpected end of JSON input").
    return jsonError(appError('internal', `Chief of Staff failed: ${(e as Error).message}`));
  }
}
