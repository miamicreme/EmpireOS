import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { createAcquisitionTarget, getAcquisitionTargets } from '@/modules/acquisitions/service';
import type { CreateAcquisitionTargetInput } from '@/modules/acquisitions/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);
  return jsonResult(await getAcquisitionTargets(supabase, auth.data));
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateAcquisitionTargetInput;
  return jsonResult(await createAcquisitionTarget(supabase, auth.data, body), 201);
}
