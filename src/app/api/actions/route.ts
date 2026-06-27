import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { createAction, getRankedActions } from '@/spine/actions/action.service';
import type { CreateGlobalActionInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

/** GET ranked actions for the authenticated user. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);
  return jsonResult(await getRankedActions(supabase, auth.data));
}

/** POST create an action. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateGlobalActionInput;
  return jsonResult(await createAction(supabase, auth.data, body), 201);
}
