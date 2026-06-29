import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk } from '@/lib/api';
import { appError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await request.json()) as Record<string, unknown>;
  const { error } = await supabase
    .from('contacts')
    .update(body)
    .eq('id', params.id)
    .eq('user_id', auth.data);

  if (error) return jsonError(appError('db_error', error.message));
  return jsonOk({ updated: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', params.id)
    .eq('user_id', auth.data);

  if (error) return jsonError(appError('db_error', error.message));
  return jsonOk({ deleted: true });
}
