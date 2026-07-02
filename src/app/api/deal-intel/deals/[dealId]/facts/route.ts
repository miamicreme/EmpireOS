import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { getCanonicalFacts, upsertCanonicalFact } from '@/modules/deal-intel/service';
import type { CanonicalFactInput } from '@/modules/deal-intel/schemas';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { dealId: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await getCanonicalFacts(supabase, params.dealId));
}

export async function POST(request: Request, { params }: { params: { dealId: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await upsertCanonicalFact(supabase, params.dealId, (await readJson(request)) as CanonicalFactInput), 201);
}
