import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deflateRawSync } from 'node:zlib';

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

function zipFixture(files: Record<string, string>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const raw = Buffer.from(content);
    const compressed = deflateRawSync(raw);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    locals.push(local, compressed);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const centralOffset = offset;
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...locals, ...centrals, end]).toString('base64');
}

function xlsxFixtureBase64() {
  return zipFixture({
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" />',
    'xl/workbook.xml': '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Funding" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>lender</t></si><si><t>loan_amount</t></si><si><t>apr</t></si><si><t>Bank A</t></si><si><t>Bank B</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>75000</v></c><c r="C2"><v>11.5</v></c></row><row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3"><v>50000</v></c><c r="C3"><v>13.25</v></c></row></sheetData></worksheet>',
  });
}

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

  it('input analyze parses XLSX bytes and keeps high-stakes routing gated', async () => {
    const { captures } = makeClient({
      tables: {
        agent_artifacts: {
          rows: [{
            id: 'artifact-xlsx',
            user_id: 'user-1',
            run_id: null,
            artifact_type: 'research_needed',
            title: 'Spreadsheet analysis: funding.xlsx',
            summary: 'persisted xlsx summary',
            content_json: {},
            source_refs: [],
            action_draft_refs: [],
            confidence: 0.86,
            risk_level: 'high',
            status: 'active',
            created_at: 'now',
          }],
        },
      },
    });
    const { POST } = await import('@/app/api/ai/input/analyze/route');
    const res = await POST(jsonRequest({
      inputType: 'xlsx',
      fileName: 'funding.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xlsxBase64: xlsxFixtureBase64(),
      createDrafts: false,
    }));
    const json = await body(res) as { ok: boolean; data?: { artifactType: string; summary: string; risks: string[] } };

    expect(res.status).toBe(201);
    expect(json.data?.artifactType).toBe('research_needed');
    const artifactInsert = captures.find((capture) => capture.table === 'agent_artifacts' && capture.payload);
    expect(JSON.stringify(artifactInsert?.payload)).toContain('Funding');
    expect(JSON.stringify(artifactInsert?.payload)).toContain('loan_amount total is 125000.00');
    expect(JSON.stringify(artifactInsert?.payload)).toContain('"researchRequired":true');
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
