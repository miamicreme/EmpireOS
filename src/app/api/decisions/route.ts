import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { createDecision } from '@/spine/decisions/decision.service';
import type { CreateDecisionInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

/** GET the user's decisions (most recent first). */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .eq('user_id', auth.data)
    .order('created_at', { ascending: false });

  if (error) {
    return jsonError({ code: 'db_error', message: error.message });
  }
  return jsonOk(data ?? []);
}

/** POST create a decision. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateDecisionInput;
  return jsonResult(await createDecision(supabase, auth.data, body), 201);
}
