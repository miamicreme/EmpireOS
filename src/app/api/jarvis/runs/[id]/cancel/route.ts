import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { requestJarvisRunCancellation } from '@/spine/jarvis/jarvis-run.repository';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

/** POST /api/jarvis/runs/[id]/cancel — owner-scoped cooperative cancellation. */
export async function POST(_request: Request, { params }: Params) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const result = await requestJarvisRunCancellation(supabase, auth.data, params.id);
  return result.ok ? jsonResult(result) : jsonError(result.error);
}
