import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { listTeams } from '@/spine/ai/teams/team-repository.service';

export const dynamic = 'force-dynamic';

/** GET /api/ai/teams — list active owner AI teams and members. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await listTeams(supabase, auth.data));
}
