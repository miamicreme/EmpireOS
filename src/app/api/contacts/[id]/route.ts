import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { deleteContact, updateContact } from '@/modules/followup-crm/service';
import type { UpdateContactInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', auth.data)
    .maybeSingle();

  if (error) return jsonError(appError('db_error', error.message));
  if (!data) return jsonError(appError('not_found', 'Contact not found.'));
  return jsonOk(data);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as UpdateContactInput;
  return jsonResult(await updateContact(supabase, auth.data, params.id, body));
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await deleteContact(supabase, auth.data, params.id));
}
