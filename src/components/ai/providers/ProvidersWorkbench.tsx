'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';

type ProviderConfig = {
  id: string;
  label: string;
  provider: string;
  model: string;
  hasOwnKey: boolean;
  usesEnvKey: boolean;
  isDefault: boolean;
  enabled: boolean;
  rank: number;
  createdAt: string;
};

type ProviderHealth = {
  configuredCount: number;
  enabledCount: number;
  hasAnyProvider: boolean;
  envProviders: string[];
  requesty: {
    configured: boolean;
    enabled: boolean;
    baseUrlConfigured: boolean;
    routePurpose: string;
    routeModels: Array<{ purpose: string; model: string; enabled: boolean }>;
    latencyMs: number | null;
    failures: number;
    estimatedCostAvailable: boolean;
  };
  lmstudio?: {
    configured: boolean;
    enabled: boolean;
    baseUrlConfigured: boolean;
    routePurpose: string;
    routeModels: Array<{ purpose: string; model: string; enabled: boolean }>;
    localOnly: boolean;
    mobileOnlyWarning: string;
    latencyMs: number | null;
    failures: number;
    estimatedCostAvailable: boolean;
  };
  providers: Array<{ id: string; provider: string; model: string; enabled: boolean; isDefault: boolean; hasOwnKey: boolean; usesEnvKey: boolean }>;
};

type ProviderTest = {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
  sample?: string;
};

const providerLabel: Record<string, string> = {
  requesty: 'Requesty',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  lmstudio: 'LM Studio',
  groq: 'Groq',
  cerebras: 'Cerebras',
  openrouter: 'OpenRouter',
  mistral: 'Mistral',
};

export function ProvidersWorkbench() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, ProviderTest>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [providersRes, healthRes] = await Promise.all([
      api.get<ProviderConfig[]>('/api/ai/providers'),
      api.get<ProviderHealth>('/api/ai/providers/health'),
    ]);
    if (providersRes.ok) setProviders(providersRes.data);
    else setError(providersRes.error.message);
    if (healthRes.ok) setHealth(healthRes.data);
    else setError(healthRes.error.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function testProvider(id: string) {
    setTestingId(id);
    const response = await api.post<ProviderTest>(`/api/ai/providers/${id}/test`, {});
    setTestingId(null);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setTests((current) => ({ ...current, [id]: response.data }));
  }

  if (loading) return <SkeletonRows rows={4} />;

  if (error) {
    return (
      <Card className="border-empire-red/20">
        <div className="p-5">
          <EmptyState icon="!" message={error} />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid gap-3 p-5 md:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface-0 p-4">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Configured</p>
            <p className="mt-2 text-2xl font-semibold text-gray-100">{health?.configuredCount ?? providers.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-0 p-4">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Enabled</p>
            <p className="mt-2 text-2xl font-semibold text-gray-100">{health?.enabledCount ?? providers.filter((p) => p.enabled).length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-0 p-4">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Any provider</p>
            <p className="mt-2 text-2xl font-semibold text-gray-100">{health?.hasAnyProvider ? 'Yes' : 'No'}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-0 p-4">
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Env keys</p>
            <p className="mt-2 text-2xl font-semibold text-gray-100">{health?.envProviders.length ?? 0}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Requesty router</p>
              <p className="mt-2 text-sm text-gray-100">
                Primary gateway: {health?.requesty.configured && health.requesty.enabled ? 'configured' : 'not configured'}
              </p>
              <p className="mt-1 text-xs font-mono text-empire-muted">
                Base URL: {health?.requesty.baseUrlConfigured ? 'configured server-side' : 'missing'} · keys never returned
              </p>
            </div>
            <Badge variant={health?.requesty.configured ? 'green' : 'muted'}>
              {health?.requesty.configured ? 'preferred' : 'fallback only'}
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface-0 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Route purpose</p>
              <p className="mt-2 text-sm text-gray-100">{health?.requesty.routePurpose ?? 'primary_router'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-0 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Latency</p>
              <p className="mt-2 text-sm text-gray-100">
                {health?.requesty.latencyMs == null ? 'not measured' : `${health.requesty.latencyMs} ms`}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-0 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Failures / cost</p>
              <p className="mt-2 text-sm text-gray-100">
                {health?.requesty.failures ?? 0} failures · {health?.requesty.estimatedCostAvailable ? 'cost available' : 'cost unavailable'}
              </p>
            </div>
          </div>

          {health?.requesty.routeModels.length ? (
            <div className="flex flex-wrap gap-2">
              {health.requesty.routeModels.map((route) => (
                <Badge key={`${route.purpose}:${route.model}`} variant="blue">
                  {route.purpose}: {route.model}
                </Badge>
              ))}
            </div>
          ) : (
            <EmptyState message="No Requesty route models are configured." />
          )}
        </div>
      </Card>

      <Card>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">LM Studio local fallback</p>
              <p className="mt-2 text-sm text-gray-100">
                Local fallback: {health?.lmstudio?.configured && health.lmstudio.enabled ? 'configured' : 'not configured'}
              </p>
              <p className="mt-1 text-xs font-mono text-empire-muted">
                {health?.lmstudio?.mobileOnlyWarning ?? 'Phones need cloud providers unless a reachable local server is running.'}
              </p>
            </div>
            <Badge variant={health?.lmstudio?.configured ? 'yellow' : 'muted'}>
              {health?.lmstudio?.configured ? 'local ready' : 'optional'}
            </Badge>
          </div>
          {health?.lmstudio?.routeModels.length ? (
            <div className="flex flex-wrap gap-2">
              {health.lmstudio.routeModels.map((route) => (
                <Badge key={`${route.purpose}:${route.model}`} variant="yellow">
                  {route.purpose}: {route.model}
                </Badge>
              ))}
            </div>
          ) : (
            <EmptyState message="No LM Studio local model is configured." />
          )}
        </div>
      </Card>

      <Card>
        <div className="space-y-4 p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Configured providers</p>
          {providers.length === 0 ? (
            <EmptyState message="No AI providers are configured yet." />
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => {
                const test = tests[provider.id];
                return (
                  <div key={provider.id} className="rounded-2xl border border-border bg-surface-0 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="blue">{provider.label}</Badge>
                          {provider.isDefault && <Badge variant="green">default</Badge>}
                          {!provider.enabled && <Badge variant="muted">disabled</Badge>}
                        </div>
                        <p className="mt-2 text-sm text-gray-100">
                          {providerLabel[provider.provider] ?? provider.provider} · {provider.model}
                        </p>
                        <p className="mt-1 text-xs font-mono text-empire-muted">
                          Key source: {provider.hasOwnKey ? 'owner key stored server-side' : provider.usesEnvKey ? 'env key available' : 'no key configured'}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" loading={testingId === provider.id} onClick={() => void testProvider(provider.id)}>
                        Test
                      </Button>
                    </div>
                    {test && (
                      <p className={`mt-3 text-sm ${test.ok ? 'text-empire-green' : 'text-empire-red'}`}>
                        {test.ok ? `Connected in ${test.latencyMs} ms` : test.error ?? 'Provider test failed'}
                        {test.sample ? ` · ${test.sample}` : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
