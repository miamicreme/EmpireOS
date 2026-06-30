import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { saveFeedback } from '@/spine/ai/agent/agent-repository.service';
import { feedbackSchema } from '@/spine/ai/agent/agent.schemas';

export const dynamic = 'force-dynamic';

/** POST agent feedback (thumbs / correction / save-memory signal). */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = feedbackSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Invalid feedback input.' });
  }
  const v = parsed.data;

  return jsonResult(
    await saveFeedback(supabase, auth.data, {
      run_id: v.runId ?? null,
      artifact_id: v.artifactId ?? null,
      feedback_type: v.feedbackType,
      rating: v.rating ?? null,
      comment: v.comment ?? null,
      suggested_correction: v.suggestedCorrection ?? null,
      should_save_as_memory: v.shouldSaveAsMemory ?? false,
      never_suggest_again: v.neverSuggestAgain ?? false,
      needs_research_next_time: v.needsResearchNextTime ?? false,
    }),
    201,
  );
}
