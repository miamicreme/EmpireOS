import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { appError } from '@/lib/errors';
import { getMissionDetail } from '@/spine/ai/teams/team-repository.service';

export const dynamic = 'force-dynamic';

/** GET /api/ai/missions/:id — safe mission detail package. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const id = params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return jsonError(appError('validation', 'Invalid mission id.'));
  }

  return jsonResult(await getMissionDetail(supabase, auth.data, id));
}
