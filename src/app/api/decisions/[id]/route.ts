import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult } from '@/lib/api';
import {
  getDecisionWithVotes,
  updateDecision,
  deleteDecision,
} from '@/spine/decisions/decision.service';
import type { UpdateDecisionInput } from '@/spine/schemas';
import { readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/decisions/:id — decision + advisor votes */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const result = await getDecisionWithVotes(supabase, auth.data, params.id);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}

/** PATCH /api/decisions/:id */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as UpdateDecisionInput;
  return jsonResult(await updateDecision(supabase, auth.data, params.id, body), 200);
}

/** DELETE /api/decisions/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await deleteDecision(supabase, auth.data, params.id), 200);
}
