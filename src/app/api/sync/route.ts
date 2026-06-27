import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk } from '@/lib/api';
import { syncAllModulesToSpine } from '@/spine/module-registry';
import { getCommandDashboardData } from '@/spine/spine-orchestrator.service';

export const dynamic = 'force-dynamic';

/** POST triggers a module sync for the authenticated user, returns dashboard. */
export async function POST() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  await syncAllModulesToSpine(auth.data);
  const dashboard = await getCommandDashboardData(supabase, auth.data);
  if (!dashboard.ok) return jsonError(dashboard.error);
  return jsonOk(dashboard.data);
}
