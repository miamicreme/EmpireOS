import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { getPendingDrafts } from '@/spine/ai/agent/agent-repository.service';
import { batchApproveDrafts } from '@/spine/ai/agent/action-draft-approval.service';
import { batchApproveSchema } from '@/spine/ai/agent/agent.schemas';

export const dynamic = 'force-dynamic';

/** GET pending agent action drafts. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await getPendingDrafts(supabase, auth.data));
}

/** POST batch approve — `{ all: true }` (all pending) or `{ ids: [...] }`. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = batchApproveSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Expected { all } or { ids }.' });
  }

  let ids = parsed.data.ids ?? [];
  if (parsed.data.all) {
    const pending = await getPendingDrafts(supabase, auth.data);
    if (!pending.ok) return jsonResult(pending);
    ids = pending.data.map((d) => d.id);
  }
  if (ids.length === 0) {
    return jsonError({ code: 'validation', message: 'No drafts to approve.' });
  }

  return jsonResult(await batchApproveDrafts(supabase, auth.data, ids));
}
