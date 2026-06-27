/**
 * GET /api/modules/metrics
 * Returns aggregated metrics from all registered modules.
 */
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk, jsonError } from '@/lib/api';
import { getAllModuleMetrics } from '@/spine/module-registry';

export async function GET() {
  const supabase = createClient();
  const userResult = await requireUserId(supabase);
  if (!userResult.ok) return jsonError(userResult.error);

  const metrics = await getAllModuleMetrics(userResult.data);
  return jsonOk({ metrics });
}
