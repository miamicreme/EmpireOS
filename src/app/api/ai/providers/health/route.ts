import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { hasAnyAiProvider, aiKeys } from '@/lib/env';
import { listProviders } from '@/spine/ai/providers/provider-config.service';
import { ok } from '@/lib/result';

export const dynamic = 'force-dynamic';

/** GET /api/ai/providers/health — secret-free provider readiness summary. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const providers = await listProviders(supabase, auth.data);
  if (!providers.ok) return jsonResult(providers);

  const enabled = providers.data.filter((provider) => provider.enabled);
  return jsonResult(
    ok({
      configuredCount: providers.data.length,
      enabledCount: enabled.length,
      hasAnyProvider: hasAnyAiProvider() || enabled.some((provider) => provider.hasOwnKey),
      envProviders: Object.entries(aiKeys)
        .filter(([, value]) => Boolean(value))
        .map(([name]) => name),
      providers: providers.data.map((provider) => ({
        id: provider.id,
        provider: provider.provider,
        model: provider.model,
        enabled: provider.enabled,
        isDefault: provider.isDefault,
        hasOwnKey: provider.hasOwnKey,
        usesEnvKey: provider.usesEnvKey,
      })),
    }),
  );
}
