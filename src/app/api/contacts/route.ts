import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createContact } from '@/modules/followup-crm/service';
import type { CreateContactInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', auth.data)
    .order('created_at', { ascending: false });

  if (error) return jsonError(appError('db_error', error.message));
  return jsonOk(data ?? []);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateContactInput;
  return jsonResult(await createContact(supabase, auth.data, body), 201);
}
