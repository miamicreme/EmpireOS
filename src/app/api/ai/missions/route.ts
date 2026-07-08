import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createMissionDraft, listMissions } from '@/spine/ai/teams/team-repository.service';
import { createMissionSchema, listMissionsQuerySchema } from '@/spine/ai/teams/team.schemas';

export const dynamic = 'force-dynamic';

/** GET /api/ai/missions — list owner missions, optionally filtered by status/team. */
export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const url = new URL(request.url);
  const parsed = listMissionsQuerySchema.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    teamId: url.searchParams.get('teamId') ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(appError('validation', 'Invalid missions query.'));
  }

  return jsonResult(await listMissions(supabase, auth.data, parsed.data));
}

/** POST /api/ai/missions — create a pending mission and instantiate its team if needed. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = createMissionSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(appError('validation', 'Invalid AI mission input.'));
  }

  return jsonResult(await createMissionDraft(supabase, auth.data, parsed.data), 201);
}
