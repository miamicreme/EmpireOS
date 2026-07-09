import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { getMissionDetail, transitionMission } from '@/spine/ai/teams/team-repository.service';
import { missionTransitionSchema } from '@/spine/ai/teams/team.schemas';

export const dynamic = 'force-dynamic';

function validMissionId(id: string) {
  return /^[0-9a-f-]{36}$/i.test(id);
}

/** GET /api/ai/missions/:id — safe mission detail package. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const id = params.id;
  if (!id || !validMissionId(id)) {
    return jsonError(appError('validation', 'Invalid mission id.'));
  }

  return jsonResult(await getMissionDetail(supabase, auth.data, id));
}

/** PATCH /api/ai/missions/:id — approval/status transition. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const id = params.id;
  if (!id || !validMissionId(id)) {
    return jsonError(appError('validation', 'Invalid mission id.'));
  }

  const parsed = missionTransitionSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(appError('validation', 'Invalid mission transition.'));
  }

  return jsonResult(await transitionMission(supabase, auth.data, id, parsed.data));
}
