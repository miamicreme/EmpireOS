import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import {
  getRecommendations,
  setRecommendationState,
} from '@/spine/ai/recommendation.service';
import { dismissRecommendationSchema } from '@/spine/ai/ai.schemas';

export const dynamic = 'force-dynamic';

/** GET recommendations (pass ?active=1 for only un-acted ones). */
export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get('active') === '1';
  return jsonResult(await getRecommendations(supabase, auth.data, { activeOnly }));
}

/** PATCH accept/dismiss a recommendation: { id, action }. */
export async function PATCH(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const raw = (await readJson(request)) as { id?: unknown };
  const id = typeof raw.id === 'string' ? raw.id : '';
  const parsed = dismissRecommendationSchema.safeParse(raw);
  if (!id || !parsed.success) {
    return jsonError({ code: 'validation', message: 'Expected { id, action }.' });
  }

  try {
    return jsonResult(
      await setRecommendationState(supabase, auth.data, id, parsed.data.action),
    );
  } catch (e) {
    return jsonError(appError('internal', `Failed to update recommendation: ${(e as Error).message}`));
  }
}
