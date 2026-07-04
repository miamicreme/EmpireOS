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
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
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
