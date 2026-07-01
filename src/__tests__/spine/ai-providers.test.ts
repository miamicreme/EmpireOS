/**
 * AI provider management tests.
 *
 * Covers the security-critical paths: encryption round-trips, the public shape
 * never carries the cipher, the 5-provider cap, credential resolution (own key
 * + decryption), and API auth enforcement.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// Deterministic 32-byte key so crypto works without SUPABASE_SERVICE_ROLE_KEY.
beforeAll(() => {
  process.env.AI_PROVIDER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

vi.mock('@/spine/events/event.service', () => ({
  emitSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Crypto
// ---------------------------------------------------------------------------
describe('crypto', () => {
  it('round-trips a secret through encrypt/decrypt', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/crypto');
    const secret = 'sk-ant-supersecret-123456';
    const token = encryptSecret(secret);
    expect(token).not.toContain(secret);
    expect(token.startsWith('v1:')).toBe(true);
    expect(decryptSecret(token)).toBe(secret);
  });

  it('produces distinct ciphertexts for the same input (random IV)', async () => {
    const { encryptSecret } = await import('@/lib/crypto');
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('rejects a tampered token', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/crypto');
    const token = encryptSecret('abc12345');
    const tampered = token.slice(0, -2) + 'xy';
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('shows only the last 4 chars as a hint', async () => {
    const { secretHint } = await import('@/lib/crypto');
    expect(secretHint('sk-abcd1234')).toBe('••••1234');
  });
});

// ---------------------------------------------------------------------------
// Recording Supabase mock (per-table rows, count + insert support)
// ---------------------------------------------------------------------------
function withId(row: Record<string, unknown> | null) {
  return row
    ? { id: 'gen-id', created_at: 't', updated_at: 't', user_id: 'user-1', ...row }
    : null;
}

function makeClient(
  tables: Record<string, Record<string, unknown>[]>,
  opts: { user?: { id: string } | null; tableErrors?: Record<string, { message: string }> } = {},
): SupabaseClient {
  const user = opts.user === undefined ? { id: 'user-1' } : opts.user;
  const tableErrors = opts.tableErrors ?? {};

  function chainFor(table: string) {
    const rows = tables[table] ?? [];
    const tableError = tableErrors[table] ?? null;
    let inserted: Record<string, unknown>[] | null = null;
    let head = false;
    const chain: Record<string, unknown> = {};
    chain.select = (_cols?: unknown, o?: { head?: boolean }) => {
      if (o?.head) head = true;
      return chain;
    };
    chain.insert = (payload: Record<string, unknown> | Record<string, unknown>[]) => {
      inserted = Array.isArray(payload) ? payload : [payload];
      return chain;
    };
    chain.upsert = (payload: Record<string, unknown> | Record<string, unknown>[]) => {
      inserted = Array.isArray(payload) ? payload : [payload];
      return chain;
    };
    chain.update = () => chain;
    chain.delete = () => chain;
    for (const m of ['eq', 'in', 'is', 'order', 'limit', 'gte', 'gt', 'lt', 'neq']) {
      chain[m] = () => chain;
    }
    chain.single = () =>
      Promise.resolve({
        data: tableError ? null : withId(inserted?.[0] ?? rows[0] ?? null),
        error: tableError,
      });
    chain.maybeSingle = () =>
      Promise.resolve({
        data: tableError ? null : withId(inserted?.[0] ?? rows[0] ?? null),
        error: tableError,
      });
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        data: tableError ? null : inserted ?? rows,
        count: head ? rows.length : undefined,
        error: tableError,
      }).then(resolve);
    return chain;
  }

  return {
    auth: {
      getUser: () =>
        Promise.resolve(
          user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'no user' } },
        ),
    },
    from: (t: string) => chainFor(t),
  } as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Provider config service
// ---------------------------------------------------------------------------
describe('provider-config.service', () => {
  it('creates a provider and never returns the cipher', async () => {
    const { createProvider } = await import('@/spine/ai/providers/provider-config.service');
    const client = makeClient({ ai_providers: [], ai_provider_secrets: [] });
    // Pass the mock as the admin client so the secret write stays in-test.
    const result = await createProvider(
      client,
      'user-1',
      {
        label: 'Claude',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-ant-abcd1234',
        isDefault: true,
        enabled: true,
      },
      client,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.provider).toBe('anthropic');
    expect(result.data.hasOwnKey).toBe(true);
    expect(result.data.apiKeyHint).toBe('••••1234');
    // The secret-free public shape must not carry the cipher.
    expect('api_key_cipher' in (result.data as unknown as Record<string, unknown>)).toBe(false);
  });

  it('enforces the 5-provider cap', async () => {
    const { createProvider } = await import('@/spine/ai/providers/provider-config.service');
    const five = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` }));
    const client = makeClient({ ai_providers: five });
    const result = await createProvider(client, 'user-1', {
      label: 'Sixth',
      provider: 'openai',
      model: 'gpt-4o',
      isDefault: false,
      enabled: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('conflict');
  });

  it('resolves a usable credential by decrypting the stored key', async () => {
    const { encryptSecret } = await import('@/lib/crypto');
    const { resolveUserCredential } = await import('@/spine/ai/providers/provider-config.service');
    const client = makeClient({
      ai_providers: [
        {
          id: 'p1',
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          has_own_key: true,
          enabled: true,
          is_default: true,
          rank: 0,
        },
      ],
      ai_provider_secrets: [
        { provider_id: 'p1', api_key_cipher: encryptSecret('sk-ant-live-9999') },
      ],
    });
    // Pass the mock as the admin client used to read the locked secrets table.
    const cred = await resolveUserCredential(client, 'user-1', client);
    expect(cred).not.toBeNull();
    expect(cred?.provider).toBe('anthropic');
    expect(cred?.model).toBe('claude-opus-4-8');
    expect(cred?.apiKey).toBe('sk-ant-live-9999');
  });

  it('surfaces a failed secret write and rolls back the provider', async () => {
    const { createProvider } = await import('@/spine/ai/providers/provider-config.service');
    const client = makeClient(
      { ai_providers: [], ai_provider_secrets: [] },
      { tableErrors: { ai_provider_secrets: { message: 'boom' } } },
    );
    const result = await createProvider(
      client,
      'user-1',
      { label: 'Claude', provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'sk-ant-abcd1234', isDefault: true, enabled: true },
      client,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('db_error');
  });

  it('propagates a secret read failure instead of masking the key', async () => {
    const { resolveCredentialForId } = await import('@/spine/ai/providers/provider-config.service');
    const client = makeClient(
      {
        ai_providers: [
          { id: 'p1', provider: 'anthropic', model: 'claude-opus-4-8', has_own_key: true, enabled: true, is_default: true, rank: 0 },
        ],
      },
      { tableErrors: { ai_provider_secrets: { message: 'read fail' } } },
    );
    const result = await resolveCredentialForId(client, 'user-1', 'p1', client);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('db_error');
  });

  it('returns null when no provider has a usable key', async () => {
    const { resolveUserCredential } = await import('@/spine/ai/providers/provider-config.service');
    // No own key + no env key for google → unusable.
    const client = makeClient({
      ai_providers: [
        { id: 'p1', provider: 'google', model: 'gemini-2.5-flash', has_own_key: false, enabled: true, is_default: true, rank: 0 },
      ],
    });
    const cred = await resolveUserCredential(client, 'user-1');
    expect(cred).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Provider failover in the structured runner
// ---------------------------------------------------------------------------
describe('runStructured provider failover', () => {
  it('falls over to the next credential when the first provider throws', async () => {
    vi.resetModules();
    const calls: string[] = [];
    vi.doMock('@/spine/ai/provider', async () => {
      const actual = await vi.importActual<typeof import('@/spine/ai/provider')>('@/spine/ai/provider');
      return {
        ...actual,
        callAI: vi.fn(async (_messages, opts) => {
          const provider = opts?.credential?.provider ?? 'env';
          calls.push(provider);
          if (provider === 'openai') {
            throw new Error('429 You exceeded your current quota');
          }
          return { text: '{"answer":"ok"}', provider, model: opts?.model ?? 'm' };
        }),
      };
    });

    const { runStructured } = await import('@/spine/ai/ai-runner');
    const { z } = await import('zod');
    const result = await runStructured({
      feature: 'test',
      systemPrompt: 'sys',
      instruction: 'hi',
      context: {},
      schema: z.object({ answer: z.string().default('') }),
      stub: { answer: 'stub' },
      credentials: [
        { provider: 'openai', apiKey: 'sk-openai', model: 'gpt-4o' },
        { provider: 'anthropic', apiKey: 'sk-ant', model: 'claude-sonnet-4-6' },
      ],
    });

    // Tried openai first (threw), then fell over to anthropic.
    expect(calls).toEqual(['openai', 'anthropic']);
    expect(result.provider).toBe('anthropic');
    expect((result.data as { answer: string }).answer).toBe('ok');
    vi.doUnmock('@/spine/ai/provider');
  });
});

// ---------------------------------------------------------------------------
// API auth
// ---------------------------------------------------------------------------
describe('AI providers API auth', () => {
  it('GET /api/ai/providers returns 401 when unauthenticated', async () => {
    vi.resetModules();
    const client = makeClient({}, { user: null });
    vi.doMock('@/lib/supabase/server', () => ({ createClient: () => client }));
    const { GET } = await import('@/app/api/ai/providers/route');
    const res = await GET();
    expect(res.status).toBe(401);
    vi.doUnmock('@/lib/supabase/server');
  });
});
