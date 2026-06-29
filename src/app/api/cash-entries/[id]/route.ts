import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { deleteCashEntry, updateCashEntry } from '@/modules/cash-engine/service';
import type { UpdateCashEntryInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as UpdateCashEntryInput;
  return jsonResult(await updateCashEntry(supabase, auth.data, params.id, body));
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await deleteCashEntry(supabase, auth.data, params.id));
}
