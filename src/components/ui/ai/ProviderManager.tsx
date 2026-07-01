'use client';

/**
 * AI Provider management (client). Configure up to 5 LLM providers/models, set
 * which one the AI layer uses by default, test connectivity, and remove them.
 * API keys are write-only — entered here, encrypted server-side, never returned.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import {
  AI_PROVIDER_MODELS,
  MAX_PROVIDERS,
  type AIProviderKind,
} from '@/spine/ai/providers/provider-config.schemas';

interface ProviderConfig {
  id: string;
  label: string;
  provider: AIProviderKind;
  model: string;
  apiKeyHint: string | null;
  hasOwnKey: boolean;
  usesEnvKey: boolean;
  isDefault: boolean;
  enabled: boolean;
  rank: number;
  createdAt: string;
}

interface TestResult {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
}

const PROVIDER_LABELS: Record<AIProviderKind, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
  google: 'Google (Gemini) · free tier',
  groq: 'Groq · free',
  cerebras: 'Cerebras · free',
  openrouter: 'OpenRouter · free models',
  mistral: 'Mistral · free tier',
};

export function ProviderManager() {
  const { success, error } = useToast();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<ProviderConfig[]>('/api/ai/providers');
    if (res.ok) setProviders(res.data);
    else error(res.error.message);
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setDefault(p: ProviderConfig) {
    const res = await api.patch(`/api/ai/providers/${p.id}`, { isDefault: true });
    if (res.ok) {
      success(`${p.label} is now the default`);
      void load();
    } else error(res.error.message);
  }

  async function toggleEnabled(p: ProviderConfig) {
    const res = await api.patch(`/api/ai/providers/${p.id}`, { enabled: !p.enabled });
    if (res.ok) void load();
    else error(res.error.message);
  }

  async function remove(p: ProviderConfig) {
    const prev = providers;
    setProviders((cur) => cur.filter((x) => x.id !== p.id));
    const res = await api.del(`/api/ai/providers/${p.id}`);
    if (res.ok) {
      success('Provider removed');
      void load();
    } else {
      setProviders(prev);
      error(res.error.message);
    }
  }

  async function test(p: ProviderConfig) {
    setTesting(p.id);
    const res = await api.post<TestResult>(`/api/ai/providers/${p.id}/test`, {});
    setTesting(null);
    if (res.ok) {
      setTests((t) => ({ ...t, [p.id]: res.data }));
      if (res.data.ok) success(`${p.label} responded in ${res.data.latencyMs}ms`);
      else error(res.data.error ?? 'Provider test failed');
    } else {
      error(res.error.message);
    }
  }

  const atCap = providers.length >= MAX_PROVIDERS;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Configured providers"
          subtitle={`${providers.length} of ${MAX_PROVIDERS} used`}
        />
        {loading ? (
          <SkeletonRows rows={3} />
        ) : providers.length === 0 ? (
          <EmptyState
            icon="✦"
            message="No AI providers yet. Add one below to power the AI Chief of Staff."
          />
        ) : (
          <div className="divide-y divide-border">
            {providers.map((p) => {
              const t = tests[p.id];
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-100 truncate">{p.label}</span>
                      {p.isDefault && <Badge variant="green">default</Badge>}
                      {!p.enabled && <Badge variant="muted">disabled</Badge>}
                    </div>
                    <div className="text-[11px] font-mono text-empire-muted mt-0.5">
                      {PROVIDER_LABELS[p.provider]} · {p.model} ·{' '}
                      {p.hasOwnKey ? `key ${p.apiKeyHint}` : p.usesEnvKey ? 'env key' : 'no key'}
                    </div>
                    {t && (
                      <div
                        className={`text-[11px] font-mono mt-0.5 ${t.ok ? 'text-empire-green' : 'text-empire-red'}`}
                      >
                        {t.ok ? `✓ ${t.latencyMs}ms` : `✕ ${t.error}`}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="subtle"
                      loading={testing === p.id}
                      onClick={() => test(p)}
                    >
                      Test
                    </Button>
                    {!p.isDefault && (
                      <Button size="sm" variant="ghost" onClick={() => setDefault(p)}>
                        Make default
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleEnabled(p)}>
                      {p.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => remove(p)}>
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {atCap ? (
        <p className="text-sm text-empire-muted font-mono">
          You&apos;ve reached the {MAX_PROVIDERS}-provider limit. Delete one to add another.
        </p>
      ) : (
        <AddProviderForm
          onAdded={() => {
            success('Provider added');
            void load();
          }}
          onError={error}
        />
      )}
    </div>
  );
}

function AddProviderForm({
  onAdded,
  onError,
}: {
  onAdded: () => void;
  onError: (msg: string) => void;
}) {
  const [provider, setProvider] = useState<AIProviderKind>('anthropic');
  const [model, setModel] = useState(AI_PROVIDER_MODELS.anthropic[0]!);
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  function onProviderChange(next: AIProviderKind) {
    setProvider(next);
    setModel(AI_PROVIDER_MODELS[next][0]!);
  }

  async function submit() {
    if (!label.trim()) {
      onError('Give this provider a label');
      return;
    }
    setSaving(true);
    const res = await api.post('/api/ai/providers', {
      label: label.trim(),
      provider,
      model,
      apiKey: apiKey.trim() || undefined,
      isDefault,
    });
    setSaving(false);
    if (res.ok) {
      setLabel('');
      setApiKey('');
      setIsDefault(false);
      onAdded();
    } else {
      onError(res.error.message);
    }
  }

  const inputCls =
    'h-9 px-3 rounded-lg bg-surface-2 border border-border text-sm text-gray-100 placeholder:text-empire-muted focus:outline-none focus:border-empire-blue';

  return (
    <Card>
      <CardHeader title="Add a provider" subtitle="Up to 5 LLMs" />
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Label</span>
          <input
            className={inputCls}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Claude Sonnet (primary)"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Provider</span>
          <select
            className={inputCls}
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as AIProviderKind)}
          >
            {(Object.keys(PROVIDER_LABELS) as AIProviderKind[]).map((k) => (
              <option key={k} value={k}>
                {PROVIDER_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Model</span>
          <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>
            {AI_PROVIDER_MODELS[provider].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">
            API key <span className="text-empire-muted/60">(optional — blank uses the env key)</span>
          </span>
          <input
            className={inputCls}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            autoComplete="off"
          />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="accent-empire-blue"
          />
          <span className="text-sm text-gray-300">Use as the default provider</span>
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <Button onClick={submit} loading={saving}>
            Add provider
          </Button>
        </div>
      </div>
    </Card>
  );
}
