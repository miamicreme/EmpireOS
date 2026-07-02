import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { getRunDetail } from '@/spine/ai/agent/agent-repository.service';

export const dynamic = 'force-dynamic';

/** GET /api/ai/agent/runs/:id — safe run detail, summaries only. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await getRunDetail(supabase, auth.data, params.id));
}
