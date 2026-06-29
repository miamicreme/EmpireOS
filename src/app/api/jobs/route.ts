import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { createJobApplication, getJobApplications } from '@/modules/job-hunt/service';
import type { CreateJobApplicationInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);
  return jsonResult(await getJobApplications(supabase, auth.data));
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateJobApplicationInput;
  return jsonResult(await createJobApplication(supabase, auth.data, body), 201);
}
