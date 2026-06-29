import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { ok } from '@/lib/result';
import { createJobApplication } from '@/modules/job-hunt/service';
import type { CreateJobApplicationInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { data, error } = await supabase
    .from('job_applications')
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

  const body = (await readJson(request)) as CreateJobApplicationInput;
  return jsonResult(await createJobApplication(supabase, auth.data, body), 201);
}
