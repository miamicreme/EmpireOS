import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { updateAcquisitionTarget } from '@/modules/acquisitions/service';
import type { UpdateAcquisitionTargetInput } from '@/modules/acquisitions/schemas';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as UpdateAcquisitionTargetInput;
  return jsonResult(await updateAcquisitionTarget(supabase, auth.data, params.id, body));
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { error } = await supabase
    .from('acquisition_targets')
    .delete()
    .eq('id', params.id)
    .eq('user_id', auth.data);

  if (error) return jsonError(appError('db_error', error.message));
  return jsonOk({ deleted: true });
}
