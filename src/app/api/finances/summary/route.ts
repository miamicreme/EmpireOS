import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { getFinanceSnapshot } from '@/modules/finances/service';

export const dynamic = 'force-dynamic';

/** GET the accounts + transactions + deterministic insight snapshot. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);
  return jsonResult(await getFinanceSnapshot(supabase, auth.data));
}
