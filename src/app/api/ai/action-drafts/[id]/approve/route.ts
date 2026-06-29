import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import {
  approveActionDraft,
  rejectActionDraft,
} from '@/spine/ai/action-draft.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/action-drafts/:id/approve
 *
 * Approves an AI action draft → creates the real global_action in the Spine.
 * Pass { reject: true } to reject instead. This is the only path by which an
 * AI-drafted action enters the execution layer.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as { reject?: boolean };
  if (body?.reject === true) {
    return jsonResult(await rejectActionDraft(supabase, auth.data, params.id));
  }

  return jsonResult(await approveActionDraft(supabase, auth.data, params.id), 201);
}
