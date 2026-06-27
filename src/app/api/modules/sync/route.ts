/**
 * POST /api/modules/sync
 * Sync all modules to the Spine and return the health report.
 */
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk, jsonError } from '@/lib/api';
import { syncAllModulesToSpine, getModuleHealthReport } from '@/spine/module-registry';

export async function POST() {
  const supabase = createClient();
  const userResult = await requireUserId(supabase);
  if (!userResult.ok) return jsonError(userResult.error);

  const userId = userResult.data;
  await syncAllModulesToSpine(userId);
  const health = await getModuleHealthReport(userId);
  return jsonOk({ synced: true, health });
}
