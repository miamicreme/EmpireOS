/**
 * GET /api/modules/health
 * Returns health status for all registered modules.
 */
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk, jsonError } from '@/lib/api';
import { getModuleHealthReport } from '@/spine/module-registry';

export async function GET() {
  const supabase = createClient();
  const userResult = await requireUserId(supabase);
  if (!userResult.ok) return jsonError(userResult.error);

  const health = await getModuleHealthReport(userResult.data);
  return jsonOk({ health });
}
