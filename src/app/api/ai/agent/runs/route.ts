import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { getRunsForThread } from '@/spine/ai/agent/agent-repository.service';

export const dynamic = 'force-dynamic';

/** GET /api/ai/agent/runs?threadId=... — run history for a thread (timeline). */
export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const url = new URL(request.url);
  const threadId = url.searchParams.get('threadId');
  if (!threadId) {
    return jsonError({ code: 'validation', message: 'threadId is required.' });
  }

  return jsonResult(await getRunsForThread(supabase, auth.data, threadId));
}
