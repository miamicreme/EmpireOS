import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import {
  approveAgentDraft,
  rejectAgentDraft,
} from '@/spine/ai/agent/action-draft-approval.service';
import { approveDraftSchema } from '@/spine/ai/agent/agent.schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/agent/action-drafts/:id/approve
 *
 * Approve (default) or reject one agent action draft. Approve optionally takes
 * `edits` (edit-then-approve). Approved drafts become Spine global_actions.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = approveDraftSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Invalid approval input.' });
  }

  if (parsed.data.action === 'reject') {
    return jsonResult(await rejectAgentDraft(supabase, auth.data, params.id));
  }
  return jsonResult(
    await approveAgentDraft(supabase, auth.data, params.id, parsed.data.edits),
    201,
  );
}
