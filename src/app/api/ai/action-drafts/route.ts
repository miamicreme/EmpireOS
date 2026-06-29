import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { getActionDrafts } from '@/spine/ai/action-draft.service';
import type { ActionDraftStatus } from '@/spine/ai/ai.types';

export const dynamic = 'force-dynamic';

const STATUSES: ActionDraftStatus[] = ['pending', 'approved', 'rejected'];

/** GET the user's AI action drafts (pass ?status=pending|approved|rejected). */
export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const url = new URL(request.url);
  const raw = url.searchParams.get('status');
  const status = raw && (STATUSES as string[]).includes(raw)
    ? (raw as ActionDraftStatus)
    : undefined;

  return jsonResult(await getActionDrafts(supabase, auth.data, status));
}
