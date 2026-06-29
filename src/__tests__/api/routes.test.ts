/**
 * API route-handler integration tests.
 *
 * Exercises the real route handlers, the real requireUserId auth helper, and
 * the real service-layer Zod validation — only the Supabase client and the
 * event emitter are mocked. This covers the security-critical layer the audit
 * flagged as untested: auth enforcement, multi-tenant (user_id) scoping, and
 * input validation on writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- mocks ------------------------------------------------------------------

// emitSystemEvent is a fire-and-forget side effect; stub it so creates don't
// need a second mocked table.
vi.mock('@/spine/events/event.service', () => ({
  emitSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

// The mock client is swapped per-test via setMockClient().
let currentClient: unknown = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => currentClient,
}));

function setMockClient(client: unknown) {
  currentClient = client;
}

// --- recording Supabase mock ------------------------------------------------

interface Captured {
  table: string | null;
  op: 'insert' | 'update' | 'delete' | 'select' | null;
  payload: unknown;
  filters: Array<[string, unknown]>;
}

/**
 * Builds a Supabase client mock that records the table, mutation op, payload,
 * and every .eq() filter. `user` controls auth.getUser(); `rows` is the data
 * returned by terminal resolvers; `dbError` injects a DB error.
 */
function makeClient(opts: {
  user?: { id: string } | null;
  rows?: unknown[];
  dbError?: { message: string } | null;
}) {
  const user = opts.user === undefined ? { id: 'user-1' } : opts.user;
  const rows = opts.rows ?? [];
  const dbError = opts.dbError ?? null;

  const captured: Captured = { table: null, op: null, payload: undefined, filters: [] };

  const result = () => ({ data: dbError ? null : rows, error: dbError });
  const singleResult = () => ({ data: dbError ? null : rows[0] ?? null, error: dbError });

  const chain: Record<string, unknown> = {};
  const ret = () => chain;
  chain.select = ret;
  chain.order = ret;
  chain.insert = (payload: unknown) => {
    captured.op = 'insert';
    captured.payload = payload;
    return chain;
  };
  chain.update = (payload: unknown) => {
    captured.op = 'update';
    captured.payload = payload;
    return chain;
  };
  chain.delete = () => {
    captured.op = 'delete';
    return chain;
  };
  chain.eq = (col: string, val: unknown) => {
    captured.filters.push([col, val]);
    return chain;
  };
  chain.single = () => Promise.resolve(singleResult());
  chain.maybeSingle = () => Promise.resolve(singleResult());
  // Thenable: terminal awaits (delete chain, list query) resolve here.
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(resolve, reject);
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result()).catch(reject);

  const client = {
    auth: {
      getUser: () =>
        Promise.resolve(
          user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'no user' } },
        ),
    },
    from(table: string) {
      captured.table = table;
      return chain;
    },
  };

  return { client, captured };
}

function jsonRequest(body: unknown): Request {
  return new Request('http://test/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readBody(res: Response): Promise<{ ok: boolean; data?: unknown; error?: { code: string } }> {
  return (await res.json()) as { ok: boolean; data?: unknown; error?: { code: string } };
}

beforeEach(() => {
  currentClient = null;
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Auth enforcement — every route returns 401 with no authenticated user
// ---------------------------------------------------------------------------
describe('auth enforcement', () => {
  it('cash-entries GET returns 401 when unauthenticated', async () => {
    const { client } = makeClient({ user: null });
    setMockClient(client);
    const { GET } = await import('@/app/api/cash-entries/route');
    const res = await GET(new Request('http://test/api/cash-entries'));
    expect(res.status).toBe(401);
    expect((await readBody(res)).error?.code).toBe('unauthorized');
  });

  it('jobs POST returns 401 when unauthenticated', async () => {
    const { client } = makeClient({ user: null });
    setMockClient(client);
    const { POST } = await import('@/app/api/jobs/route');
    const res = await POST(jsonRequest({ company: 'Acme', role: 'Eng' }));
    expect(res.status).toBe(401);
  });

  it('contacts [id] PATCH returns 401 when unauthenticated', async () => {
    const { client } = makeClient({ user: null });
    setMockClient(client);
    const { PATCH } = await import('@/app/api/contacts/[id]/route');
    const res = await PATCH(jsonRequest({ name: 'X' }), { params: { id: 'c-1' } });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Multi-tenant isolation — writes are always scoped by user_id
// ---------------------------------------------------------------------------
describe('multi-tenant scoping', () => {
  it('cash-entries PATCH scopes update by both id and user_id', async () => {
    const { client, captured } = makeClient({ user: { id: 'user-42' }, rows: [{ id: 'ce-1' }] });
    setMockClient(client);
    const { PATCH } = await import('@/app/api/cash-entries/[id]/route');
    const res = await PATCH(jsonRequest({ source: 'gig' }), { params: { id: 'ce-1' } });
    expect(res.status).toBe(200);
    expect(captured.op).toBe('update');
    expect(captured.filters).toContainEqual(['id', 'ce-1']);
    expect(captured.filters).toContainEqual(['user_id', 'user-42']);
  });

  it('jobs DELETE scopes delete by both id and user_id', async () => {
    const { client, captured } = makeClient({ user: { id: 'user-42' } });
    setMockClient(client);
    const { DELETE } = await import('@/app/api/jobs/[id]/route');
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), { params: { id: 'j-9' } });
    expect(res.status).toBe(200);
    expect(captured.op).toBe('delete');
    expect(captured.filters).toContainEqual(['id', 'j-9']);
    expect(captured.filters).toContainEqual(['user_id', 'user-42']);
  });

  it('contacts GET scopes list query by user_id', async () => {
    const { client, captured } = makeClient({ user: { id: 'user-7' }, rows: [] });
    setMockClient(client);
    const { GET } = await import('@/app/api/contacts/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(captured.filters).toContainEqual(['user_id', 'user-7']);
  });

  it('cash-entries POST attaches user_id to the inserted row', async () => {
    const { client, captured } = makeClient({ user: { id: 'user-99' }, rows: [{ id: 'ce-new' }] });
    setMockClient(client);
    const { POST } = await import('@/app/api/cash-entries/route');
    const res = await POST(jsonRequest({ source: 'gig', gross_amount: 100 }));
    expect(res.status).toBe(201);
    expect(captured.op).toBe('insert');
    expect((captured.payload as { user_id: string }).user_id).toBe('user-99');
  });
});

// ---------------------------------------------------------------------------
// Input validation — invalid bodies are rejected before touching the DB
// ---------------------------------------------------------------------------
describe('write validation', () => {
  it('cash-entries PATCH rejects a wrong-typed field with 422 and no DB write', async () => {
    const { client, captured } = makeClient({ user: { id: 'user-1' } });
    setMockClient(client);
    const { PATCH } = await import('@/app/api/cash-entries/[id]/route');
    // gross_amount must be a number
    const res = await PATCH(jsonRequest({ gross_amount: 'lots' }), { params: { id: 'ce-1' } });
    expect(res.status).toBe(422);
    expect((await readBody(res)).error?.code).toBe('validation');
    expect(captured.op).toBeNull();
  });

  it('contacts PATCH rejects an invalid email with 422', async () => {
    const { client } = makeClient({ user: { id: 'user-1' } });
    setMockClient(client);
    const { PATCH } = await import('@/app/api/contacts/[id]/route');
    const res = await PATCH(jsonRequest({ email: 'not-an-email' }), { params: { id: 'c-1' } });
    expect(res.status).toBe(422);
  });

  it('jobs PATCH rejects an invalid URL with 422', async () => {
    const { client } = makeClient({ user: { id: 'user-1' } });
    setMockClient(client);
    const { PATCH } = await import('@/app/api/jobs/[id]/route');
    const res = await PATCH(jsonRequest({ job_url: 'notaurl' }), { params: { id: 'j-1' } });
    expect(res.status).toBe(422);
  });

  it('jobs POST rejects a missing required field with 422', async () => {
    const { client } = makeClient({ user: { id: 'user-1' } });
    setMockClient(client);
    const { POST } = await import('@/app/api/jobs/route');
    // role is required
    const res = await POST(jsonRequest({ company: 'Acme' }));
    expect(res.status).toBe(422);
  });

  it('cash-entries PATCH with malformed JSON does not 500', async () => {
    const { client } = makeClient({ user: { id: 'user-1' }, rows: [{ id: 'ce-1' }] });
    setMockClient(client);
    const { PATCH } = await import('@/app/api/cash-entries/[id]/route');
    const bad = new Request('http://test', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });
    const res = await PATCH(bad, { params: { id: 'ce-1' } });
    // readJson swallows the parse error -> empty object -> valid partial update
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// not_found + db_error mapping
// ---------------------------------------------------------------------------
describe('error mapping', () => {
  it('cash-entries PATCH returns 404 when no row matches', async () => {
    const { client } = makeClient({ user: { id: 'user-1' }, rows: [] });
    setMockClient(client);
    const { PATCH } = await import('@/app/api/cash-entries/[id]/route');
    const res = await PATCH(jsonRequest({ source: 'gig' }), { params: { id: 'missing' } });
    expect(res.status).toBe(404);
    expect((await readBody(res)).error?.code).toBe('not_found');
  });

  it('contacts POST surfaces a DB error as 500', async () => {
    const { client } = makeClient({ user: { id: 'user-1' }, dbError: { message: 'boom' } });
    setMockClient(client);
    const { POST } = await import('@/app/api/contacts/route');
    const res = await POST(jsonRequest({ name: 'A', contact_type: 'recruiter' }));
    expect(res.status).toBe(500);
    expect((await readBody(res)).error?.code).toBe('db_error');
  });
});
