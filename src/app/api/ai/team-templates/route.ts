import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { listTeamTemplates } from '@/spine/ai/teams/team-repository.service';

export const dynamic = 'force-dynamic';

/** GET /api/ai/team-templates — list system + owner AI team templates. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await listTeamTemplates(supabase, auth.data));
}
