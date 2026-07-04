import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { listProviders } from '@/spine/ai/providers/provider-config.service';
import { ok } from '@/lib/result';
import { buildProviderHealthSummary } from '@/spine/ai/providers/provider-health.service';

export const dynamic = 'force-dynamic';

/** GET /api/ai/providers/health — secret-free provider readiness summary. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const providers = await listProviders(supabase, auth.data);
  if (!providers.ok) return jsonResult(providers);

  const enabled = providers.data.filter((provider) => provider.enabled);
  return jsonResult(ok(buildProviderHealthSummary(providers.data, enabled.length)));
}
