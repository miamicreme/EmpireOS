import { aiKeys, hasAnyAiProvider } from '@/lib/env';
import { getProviderCapabilities } from '@/spine/ai/provider-capabilities';
import type { ProviderConfig } from './provider-config.service';

export function buildProviderHealthSummary(
  providers: ProviderConfig[],
  enabledCount = providers.filter((provider) => provider.enabled).length,
) {
  const capabilities = getProviderCapabilities();
  const requesty = capabilities.find((provider) => provider.provider === 'requesty');
  return {
    configuredCount: providers.length,
    enabledCount,
    hasAnyProvider:
      hasAnyAiProvider() || providers.some((provider) => provider.enabled && provider.hasOwnKey),
    envProviders: Object.entries(aiKeys)
      .filter(([, value]) => Boolean(value))
      .map(([name]) => name),
    requesty: {
      configured: Boolean(requesty?.configured),
      enabled: Boolean(requesty?.enabled),
      baseUrlConfigured: Boolean(process.env.REQUESTY_BASE_URL || 'https://router.requesty.ai/v1'),
      routePurpose: 'primary_router',
      routeModels: requesty?.models ?? [],
      latencyMs: null,
      failures: 0,
      estimatedCostAvailable: false,
    },
    providers: providers.map((provider) => ({
      id: provider.id,
      provider: provider.provider,
      model: provider.model,
      enabled: provider.enabled,
      isDefault: provider.isDefault,
      hasOwnKey: provider.hasOwnKey,
      usesEnvKey: provider.usesEnvKey,
    })),
  };
}
