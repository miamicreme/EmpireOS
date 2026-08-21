import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { getEmpireRun } from '@/spine/empire/empire-run.repository';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

/** GET /api/empire/runs/[id] — safe owner-scoped run detail. */
export async function GET(_request: Request, { params }: Params) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const result = await getEmpireRun(supabase, auth.data, params.id);
  return result.ok ? jsonResult(result) : jsonError(result.error);
}
