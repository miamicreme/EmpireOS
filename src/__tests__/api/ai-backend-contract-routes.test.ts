import { beforeEach, describe, expect, it, vi } from 'vitest';

let currentClient: unknown = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => currentClient,
}));

interface TableResult {
  rows?: unknown[];
  count?: number;
  error?: { message: string } | null;
}

interface Capture {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | null;
  payload?: unknown;
  filters: Array<[string, unknown]>;
}

function makeClient(opts: {
  user?: { id: string } | null;
  tables?: Record<string, TableResult>;
}) {
  const user = opts.user === undefined ? { id: 'user-1' } : opts.user;
  const tables = opts.tables ?? {};
  const captures: Capture[] = [];

  function from(table: string) {
    const tableResult = tables[table] ?? { rows: [] };
    const capture: Capture = { table, op: null, filters: [] };
    captures.push(capture);

    const result = () => ({
      data: tableResult.error ? null : tableResult.rows ?? [],
      count: tableResult.count ?? null,
      error: tableResult.error ?? null,
    });
    const singleResult = () => ({
      data: tableResult.error ? null : tableResult.rows?.[0] ?? null,
      count: tableResult.count ?? null,
      error: tableResult.error ?? null,
    });

    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    chain.select = () => {
      capture.op = 'select';
      return chain;
    };
    chain.order = ret;
    chain.limit = ret;
    chain.eq = (col: string, value: unknown) => {
      capture.filters.push([col, value]);
      return chain;
    };
    chain.insert = (payload: unknown) => {
      capture.op = 'insert';
      capture.payload = payload;
      return chain;
    };
    chain.update = (payload: unknown) => {
      capture.op = 'update';
      capture.payload = payload;
      return chain;
    };
    chain.delete = () => {
      capture.op = 'delete';
      return chain;
    };
    chain.single = () => Promise.resolve(singleResult());
    chain.maybeSingle = () => Promise.resolve(singleResult());
    chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject);
    chain.catch = (reject: (error: unknown) => unknown) => Promise.resolve(result()).catch(reject);
    return chain;
  }

  currentClient = {
    auth: {
      getUser: () =>
        Promise.resolve(
          user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'no user' } },
        ),
    },
    from,
  };

  return { captures };
}

function jsonRequest(body: unknown, url = 'http://test/api') {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

async function body(res: Response) {
  return (await res.json()) as { ok: boolean; data?: unknown; error?: { code: string; message: string } };
}

beforeEach(() => {
  currentClient = null;
  vi.resetModules();
});

describe('new AI backend route contracts', () => {
  it('run detail requires auth', async () => {
    makeClient({ user: null });
    const { GET } = await import('@/app/api/ai/agent/runs/[id]/route');
    const res = await GET(new Request('http://test/api/ai/agent/runs/r1'), { params: { id: 'r1' } });
    expect(res.status).toBe(401);
    expect((await body(res)).error?.code).toBe('unauthorized');
  });

  it('run detail scopes all runtime reads to the owner and omits raw event payloads', async () => {
    const { captures } = makeClient({
      tables: {
        agent_runs: { rows: [{ id: 'r1', user_id: 'user-1', user_command: 'summarize', metadata: {} }] },
        agent_run_events: { rows: [{ id: 'e1', event_order: 1, event_type: 'final_synthesized', status: 'complete', summary: 'Safe summary', latency_ms: 5, created_at: 'now' }] },
        agent_artifacts: { rows: [] },
        agent_action_drafts: { rows: [] },
        agent_provider_runs: { rows: [] },
      },
    });
    const { GET } = await import('@/app/api/ai/agent/runs/[id]/route');
    const res = await GET(new Request('http://test/api/ai/agent/runs/r1'), { params: { id: 'r1' } });
    const json = await body(res);

    expect(res.status).toBe(200);
    expect(JSON.stringify(json)).not.toContain('payload');
    expect(captures.filter((capture) => capture.table.startsWith('agent_')).every((capture) =>
      capture.filters.some(([col, value]) => col === 'user_id' && value === 'user-1'),
    )).toBe(true);
  });

  it('memory PATCH rejects high-risk secrets before update', async () => {
    const { captures } = makeClient({});
    const { PATCH } = await import('@/app/api/ai/agent/memory/[id]/route');
    const res = await PATCH(jsonRequest({ content: 'SSN 123-45-6789' }), { params: { id: 'm1' } });

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe('redaction_blocked');
    expect(captures.some((capture) => capture.op === 'update')).toBe(false);
  });

  it('memory DELETE soft deletes with owner scope', async () => {
    const { captures } = makeClient({ tables: { agent_memory_items: { rows: [{ id: 'm1' }] } } });
    const { DELETE } = await import('@/app/api/ai/agent/memory/[id]/route');
    const res = await DELETE(new Request('http://test/api/ai/agent/memory/m1', { method: 'DELETE' }), { params: { id: 'm1' } });

    expect(res.status).toBe(200);
    const update = captures.find((capture) => capture.table === 'agent_memory_items' && capture.op === 'update');
    expect(update?.payload).toEqual({ status: 'deleted' });
    expect(update?.filters).toContainEqual(['id', 'm1']);
    expect(update?.filters).toContainEqual(['user_id', 'user-1']);
  });

  it('provider health is secret-free', async () => {
    makeClient({
      tables: {
        ai_providers: {
          rows: [{
            id: 'p1', label: 'OpenAI', provider: 'openai', model: 'gpt', api_key_hint: '••••1234',
            has_own_key: true, is_default: true, enabled: true, rank: 0, created_at: 'now', updated_at: 'now', user_id: 'user-1',
          }],
        },
      },
    });
    const { GET } = await import('@/app/api/ai/providers/health/route');
    const res = await GET();
    const json = await body(res);

    expect(res.status).toBe(200);
    expect(JSON.stringify(json)).not.toContain('api_key_cipher');
    expect(JSON.stringify(json)).not.toContain('apiKey');
    expect(JSON.stringify(json)).toContain('requesty');
  });

  it('camera-frame preserves vision_provider_required for real image bytes', async () => {
    const envKeys = [
      'REQUESTY_API_KEY',
      'REQUESTY_DEFAULT_MODEL',
      'REQUESTY_FAST_MODEL',
      'REQUESTY_STANDARD_MODEL',
      'REQUESTY_DEEP_MODEL',
      'REQUESTY_VISION_MODEL',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
    ] as const;
    const saved = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    for (const key of envKeys) delete process.env[key];

    try {
      makeClient({});
      const { POST } = await import('@/app/api/ai/input/camera-frame/route');
      const res = await POST(jsonRequest({
        fileName: 'camera.png',
        mimeType: 'image/png',
        imageDescription: 'Owner captured camera frame.',
        imageBase64: tinyPngBase64,
        allowVision: true,
      }));
      const json = await body(res);

      expect(res.status).toBe(422);
      expect(json.error?.code).toBe('validation');
      expect(json.error?.message).toContain('vision_provider_required');
    } finally {
      for (const key of envKeys) {
        const value = saved[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('security status returns posture only', async () => {
    makeClient({ tables: { webauthn_credentials: { rows: [], count: 2 } } });
    const { GET } = await import('@/app/api/settings/security/status/route');
    const res = await GET();
    const json = await body(res) as { ok: boolean; data: { secretValuesReturned: boolean; passkeyCount: number } };

    expect(res.status).toBe(200);
    expect(json.data.passkeyCount).toBe(2);
    expect(json.data.secretValuesReturned).toBe(false);
  });
});
