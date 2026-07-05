import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { listRecordings } from '@/modules/recorder/service';

export const dynamic = 'force-dynamic';

/** GET /api/recorder — list the owner's recordings, most recent first. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await listRecordings(supabase, auth.data));
}
