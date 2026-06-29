import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { updateCreditItem } from '@/modules/credit-funding/service';
import type { UpdateCreditItemInput } from '@/modules/credit-funding/schemas';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as UpdateCreditItemInput;
  return jsonResult(await updateCreditItem(supabase, auth.data, params.id, body));
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { error } = await supabase
    .from('credit_items')
    .delete()
    .eq('id', params.id)
    .eq('user_id', auth.data);

  if (error) return jsonError(appError('db_error', error.message));
  return jsonOk({ deleted: true });
}
