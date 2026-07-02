import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { updateMemoryItem } from '@/spine/ai/agent/agent-repository.service';

export const dynamic = 'force-dynamic';

/** POST /api/ai/agent/memory/:id/approve — approve or reject a memory item/request. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as { action?: 'approve' | 'reject' };
  const status = body.action === 'reject' ? 'archived' : 'active';
  return jsonResult(await updateMemoryItem(supabase, auth.data, params.id, { status }));
}
