/**
 * GET /api/modules/actions
 * Returns aggregated actions from all registered modules.
 */
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk, jsonError } from '@/lib/api';
import { getAllModuleActions } from '@/spine/module-registry';

export async function GET() {
  const supabase = createClient();
  const userResult = await requireUserId(supabase);
  if (!userResult.ok) return jsonError(userResult.error);

  const actions = await getAllModuleActions(userResult.data);
  return jsonOk({ actions });
}
