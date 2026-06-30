import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import {
  updateProvider,
  deleteProvider,
} from '@/spine/ai/providers/provider-config.service';
import type { UpdateProviderInput } from '@/spine/ai/providers/provider-config.schemas';

export const dynamic = 'force-dynamic';

/** PATCH update a provider (label/model/key/default/enabled/rank). */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as UpdateProviderInput;
  return jsonResult(await updateProvider(supabase, auth.data, params.id, body));
}

/** DELETE a provider. */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await deleteProvider(supabase, auth.data, params.id));
}
