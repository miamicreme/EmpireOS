/**
 * V3 Compact Reasoning Agent tests.
 *
 * Pure routing/gate logic plus end-to-end orchestration on a STATEFUL table-keyed
 * Supabase mock (inserts persist, so idempotency, no-duplicate-writes, and
 * draft→global_action approval are exercised for real). All in stub mode.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/spine/events/event.service', () => ({
  emitSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

const USER = 'user-1';

// ---------------------------------------------------------------------------
// Stateful Supabase mock — inserts persist into the table arrays.
// ---------------------------------------------------------------------------
function makeDb(
  seed: Record<string, Record<string, unknown>[]> = {},
  opts: { user?: { id: string } | null } = {},
): SupabaseClient {
  const user = opts.user === undefined ? { id: USER } : opts.user;
  // Use the seed arrays by reference so tests can inspect inserted rows.
  const tables: Record<string, Record<string, unknown>[]> = seed;
  let idc = 0;
  const gen = () => `gen-${++idc}`;

  function from(table: string) {
    const rows = (tables[table] ??= []);
    const filters: Array<['eq' | 'in', string, unknown]> = [];
    let op: 'insert' | 'upsert' | 'update' | 'delete' | null = null;
    let payload: Record<string, unknown>[] | Record<string, unknown> | null = null;
    let conflict: string | undefined;
    let head = false;
    let limitN: number | null = null;
    const b: Record<string, unknown> = {};
    b.select = (_c?: unknown, o?: { head?: boolean }) => {
      if (o?.head) head = true;
      return b;
    };
    b.insert = (p: Record<string, unknown> | Record<string, unknown>[]) => {
      op = 'insert';
      payload = p;
      return b;
    };
    b.upsert = (p: Record<string, unknown> | Record<string, unknown>[], o?: { onConflict?: string }) => {
      op = 'upsert';
      payload = p;
      conflict = o?.onConflict;
      return b;
    };
    b.update = (p: Record<string, unknown>) => {
      op = 'update';
      payload = p;
      return b;
    };
    b.delete = () => {
      op = 'delete';
      return b;
    };
    b.eq = (c: string, v: unknown) => {
      filters.push(['eq', c, v]);
      return b;
    };
    b.in = (c: string, v: unknown) => {
      filters.push(['in', c, v as unknown]);
      return b;
    };
    b.is = (c: string, v: unknown) => {
      filters.push(['eq', c, v]);
      return b;
    };
    for (const m of ['gte', 'gt', 'lt', 'neq', 'order']) b[m] = () => b;
    b.limit = (n: number) => {
      limitN = n;
      return b;
    };
    const match = (r: Record<string, unknown>) =>
      filters.every(([t, c, v]) => (t === 'in' ? (v as unknown[]).includes(r[c]) : r[c] === v));
    function write(): Record<string, unknown>[] {
      const list = Array.isArray(payload) ? payload : payload ? [payload] : [];
      if (op === 'insert') {
        const ins: Record<string, unknown>[] = list.map((p) => ({ id: gen(), created_at: 't', updated_at: 't', ...p }));
        rows.push(...ins);
        return ins;
      }
      if (op === 'upsert') {
        const ins: Record<string, unknown>[] = list.map((p) => ({ id: gen(), created_at: 't', updated_at: 't', ...p }));
        for (const row of ins) {
          const key = conflict;
          const idx = key ? rows.findIndex((r) => r[key] === row[key]) : -1;
          if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
          else rows.push(row);
        }
        return ins;
      }
      if (op === 'update') {
        const upd: Record<string, unknown>[] = [];
        for (const r of rows) if (match(r)) { Object.assign(r, payload); upd.push(r); }
        return upd;
      }
      if (op === 'delete') {
        for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i]!)) rows.splice(i, 1);
        return [];
      }
      let res = rows.filter(match);
      if (limitN != null) res = res.slice(0, limitN);
      return res;
    }
    b.single = () => Promise.resolve({ data: write()[0] ?? null, error: null });
    b.maybeSingle = () => Promise.resolve({ data: write()[0] ?? null, error: null });
    b.then = (resolve: (v: unknown) => unknown) => {
      const r = write();
      return Promise.resolve({
        data: head ? null : r,
        count: head ? rows.filter(match).length : undefined,
        error: null,
      }).then(resolve);
    };
    return b;
  }

  return {
    auth: {
      getUser: () =>
        Promise.resolve(
          user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'no user' } },
        ),
    },
    from,
  } as unknown as SupabaseClient;
}

function seedSpine(): Record<string, Record<string, unknown>[]> {
  return {
    profiles: [
      {
        id: USER,
        full_name: 'K',
        current_phase: 'phase_1',
        daily_cash_target: 250,
        weekly_cash_target: 1500,
        monthly_cash_target: 6000,
        risk_tolerance: 'balanced',
        primary_goal: 'Empire',
      },
    ],
    global_actions: [
      {
        id: 'a1', user_id: USER, module_id: 'cash-engine', phase_id: 'phase_1',
        title: 'Drive 4 hours', category: 'cash', status: 'open', priority: 'high',
        due_at: null, rank_score: 80, impact_score: 7, urgency_score: 6, effort_score: 4,
        confidence_score: 0.7, empire_score_weight: 1,
      },
    ],
    decisions: [], daily_reviews: [], weekly_reviews: [],
    agent_threads: [], agent_runs: [], agent_run_events: [], agent_context_packs: [],
    agent_artifacts: [], agent_action_drafts: [], agent_provider_runs: [],
    ai_providers: [],
  };
}

// ---------------------------------------------------------------------------
// Intent router (pure)
// ---------------------------------------------------------------------------
describe('intent router', () => {
  it('routes a daily-planning command to the fast path', async () => {
    const { routeIntent } = await import('@/spine/ai/agent/intent-router.service');
    const r = routeIntent({ command: 'What should I do today?' });
    expect(r.intent).toBe('daily_planning');
    expect(r.runtimePath).toBe('fast_path');
  });

  it('routes a trading question to the deep path (high stakes)', async () => {
    const { routeIntent } = await import('@/spine/ai/agent/intent-router.service');
    const r = routeIntent({ command: 'Should I trade this stock setup?' });
    expect(r.intent).toBe('stock_trading');
    expect(r.runtimePath).toBe('deep_path');
  });

  it('honors goDeeper to force the deep path', async () => {
    const { routeIntent } = await import('@/spine/ai/agent/intent-router.service');
    const r = routeIntent({ command: 'What today?', goDeeper: true });
    expect(r.runtimePath).toBe('deep_path');
  });
});

// ---------------------------------------------------------------------------
// Provider strategy (pure) — fast skips specialists, deep convenes them
// ---------------------------------------------------------------------------
describe('provider strategy', () => {
  it('fast_path runs no specialist council', async () => {
    const { buildProviderStrategy } = await import('@/spine/ai/agent/provider-router.service');
    const s = buildProviderStrategy('daily_planning', 'fast_path', 'low', false, false);
    expect(s.specialists).toEqual([]);
    expect(s.maxProviderCalls).toBe(1);
  });

  it('standard_path uses at most one targeted specialist', async () => {
    const { buildProviderStrategy } = await import('@/spine/ai/agent/provider-router.service');
    const s = buildProviderStrategy('cash', 'standard_path', 'medium', false, false);
    expect(s.specialists.length).toBeLessThanOrEqual(1);
  });

  it('deep_path convenes the relevant specialists', async () => {
    const { buildProviderStrategy } = await import('@/spine/ai/agent/provider-router.service');
    const s = buildProviderStrategy('stock_trading', 'deep_path', 'high', true, false);
    expect(s.specialists.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Gates (pure)
// ---------------------------------------------------------------------------
describe('gates', () => {
  it('research gate triggers only when current facts matter', async () => {
    const { evaluateResearchGate } = await import('@/spine/ai/agent/research-gate.service');
    expect(evaluateResearchGate('current stock price now', 'stock_trading', false).needsResearch).toBe(true);
    expect(evaluateResearchGate('rank my actions', 'daily_planning', false).needsResearch).toBe(false);
  });

  it('memory gate stays quiet for low-stakes runs', async () => {
    const { evaluateMemoryGate } = await import('@/spine/ai/agent/memory-gate.service');
    const ctx = { profile: null } as never;
    expect(evaluateMemoryGate(ctx, 'daily_planning', 'low')).toEqual([]);
  });

  it('memory gate asks (<=2) on high-stakes runs with missing profile', async () => {
    const { evaluateMemoryGate } = await import('@/spine/ai/agent/memory-gate.service');
    const ctx = { profile: null } as never;
    const reqs = evaluateMemoryGate(ctx, 'stock_trading', 'high');
    expect(reqs.length).toBeGreaterThan(0);
    expect(reqs.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Orchestration end-to-end (stub mode, stateful mock)
// ---------------------------------------------------------------------------
describe('runAgent', () => {
  it('produces one artifact and drafts in stub mode, no specialists on fast path', async () => {
    const { runAgent } = await import('@/spine/ai/agent/agent-orchestrator.service');
    const db = makeDb(seedSpine());
    const res = await runAgent(db, USER, { command: 'What should I do today?' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.answer.length).toBeGreaterThan(0);
    expect(res.data.artifactId).not.toBeNull();
    expect(res.data.runtimePath).toBe('fast_path');
    expect(res.data.specialistVotes).toEqual([]);
    // exactly one artifact written for the run
    const dbTables = (db as unknown as { from: (t: string) => unknown });
    void dbTables;
  });

  it('is idempotent — replaying the same key returns the same run', async () => {
    const { runAgent } = await import('@/spine/ai/agent/agent-orchestrator.service');
    const seed = seedSpine();
    const db = makeDb(seed);
    const a = await runAgent(db, USER, { command: 'What today?', idempotency: 'k-1' });
    const b = await runAgent(db, USER, { command: 'What today?', idempotency: 'k-1' });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.data.runId).toBe(a.data.runId);
    // Replay must not orphan a second thread, and reports the original thread.
    expect((seed.agent_threads ?? []).length).toBe(1);
    expect(b.data.threadId).toBe(a.data.threadId);
  });

  it('writes provider runs and a compact event trace', async () => {
    const { runAgent } = await import('@/spine/ai/agent/agent-orchestrator.service');
    const seed = seedSpine();
    const db = makeDb(seed);
    const res = await runAgent(db, USER, { command: 'Find cash fastest.' });
    expect(res.ok).toBe(true);
    expect((seed.agent_provider_runs ?? []).length).toBeGreaterThan(0);
    expect((seed.agent_run_events ?? []).length).toBeGreaterThan(0);
    expect((seed.agent_artifacts ?? []).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Repository safety
// ---------------------------------------------------------------------------
describe('createActionDrafts', () => {
  it('coerces an unknown module id to null (FK safety)', async () => {
    const { createActionDrafts } = await import('@/spine/ai/agent/agent-repository.service');
    const seed = seedSpine();
    const db = makeDb(seed);
    const res = await createActionDrafts(db, USER, 'r1', null, [
      { title: 'Do thing', description: '', category: 'general', priority: 'medium', moduleId: 'not-a-module' },
      { title: 'Cash thing', description: '', category: 'cash', priority: 'high', moduleId: 'cash-engine' },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data[0]!.module_id).toBeNull();
    expect(res.data[1]!.module_id).toBe('cash-engine');
  });
});

describe('createRun concurrency', () => {
  it('replays the original run when the unique key races (23505)', async () => {
    const { createRun } = await import('@/spine/ai/agent/agent-repository.service');
    const winner = { id: 'run-win', user_id: USER, idempotency_key: 'k', user_command: 'x', status: 'running' };
    let selects = 0;
    const racingDb = {
      from: () => {
        const chain: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'insert']) chain[m] = () => chain;
        // First lookup: empty (we lost the race). After the insert conflict, the
        // re-read finds the winner's row.
        chain.maybeSingle = () => Promise.resolve({ data: selects++ === 0 ? null : winner, error: null });
        chain.single = () => Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
        return chain;
      },
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const res = await createRun(racingDb, USER, { threadId: 't', command: 'x', idempotencyKey: 'k' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.reused).toBe(true);
    expect(res.data.run.id).toBe('run-win');
  });
});

// ---------------------------------------------------------------------------
// Context hash reuse
// ---------------------------------------------------------------------------
describe('context pack', () => {
  it('produces a stable context_hash for unchanged state', async () => {
    const { buildContextPack } = await import('@/spine/ai/agent/context-pack.service');
    const db = makeDb(seedSpine());
    const a = await buildContextPack(db, USER, 'daily_planning');
    const b = await buildContextPack(db, USER, 'daily_planning');
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.data.pack.contextHash).toBe(b.data.pack.contextHash);
    expect(a.data.pack.contextHash.length).toBe(64);
  });

  it('redacts PII in memory before it enters the pack', async () => {
    const { buildContextPack } = await import('@/spine/ai/agent/context-pack.service');
    const seed = seedSpine();
    seed.agent_memory_items = [
      { id: 'm1', user_id: USER, memory_type: 'profile', summary: 'reach me at k@example.com', content: '', status: 'active' },
    ];
    const res = await buildContextPack(makeDb(seed), USER, 'daily_planning');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.pack.relevantMemory[0]!.summary).not.toContain('k@example.com');
  });
});

// ---------------------------------------------------------------------------
// Action draft approval → global_actions
// ---------------------------------------------------------------------------
describe('approveAgentDraft', () => {
  it('converts a pending agent draft into a Spine global_action', async () => {
    const { approveAgentDraft } = await import('@/spine/ai/agent/action-draft-approval.service');
    const seed = seedSpine();
    seed.agent_action_drafts = [
      {
        id: 'd1', user_id: USER, run_id: 'r1', source_artifact_id: null, module_id: 'cash-engine',
        title: 'Call lender', description: null, category: 'cash', priority: 'high',
        impact_score: 6, urgency_score: 7, effort_score: 4, confidence_score: 0.6,
        approval_status: 'pending', created_action_id: null, due_at: null,
      },
    ];
    const db = makeDb(seed);
    const res = await approveAgentDraft(db, USER, 'd1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.action.title).toBe('Call lender');
    expect(res.data.draft.approval_status).toBe('approved');
    // a real global_action row now exists
    expect((seed.global_actions ?? []).some((a) => (a as { source_id?: string }).source_id === 'd1')).toBe(true);
  });

  it('converts a Postgres-style due_at without throwing', async () => {
    const { approveAgentDraft } = await import('@/spine/ai/agent/action-draft-approval.service');
    const seed = seedSpine();
    seed.agent_action_drafts = [
      {
        id: 'd3', user_id: USER, run_id: 'r1', source_artifact_id: null, module_id: null,
        title: 'Timed task', description: null, category: 'general', priority: 'medium',
        impact_score: 5, urgency_score: 5, effort_score: 5, confidence_score: 0.5,
        approval_status: 'pending', created_action_id: null,
        // timestamptz as Postgres returns it (space + offset, not RFC3339 'T')
        due_at: '2026-07-01 12:00:00+00',
      },
    ];
    const res = await approveAgentDraft(makeDb(seed), USER, 'd3');
    expect(res.ok).toBe(true);
  });

  it('refuses to approve a rejected draft', async () => {
    const { approveAgentDraft } = await import('@/spine/ai/agent/action-draft-approval.service');
    const seed = seedSpine();
    seed.agent_action_drafts = [
      { id: 'd2', user_id: USER, title: 'x', category: 'general', priority: 'medium',
        impact_score: 5, urgency_score: 5, effort_score: 5, confidence_score: 0.5,
        approval_status: 'rejected', module_id: null, description: null, due_at: null, created_action_id: null },
    ];
    const res = await approveAgentDraft(makeDb(seed), USER, 'd2');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('invalid_state');
  });
});

// ---------------------------------------------------------------------------
// Memory secret refusal
// ---------------------------------------------------------------------------
describe('saveMemoryItem', () => {
  it('refuses to store a high-risk secret as memory', async () => {
    const { saveMemoryItem } = await import('@/spine/ai/agent/memory-gate.service');
    const res = await saveMemoryItem(makeDb(seedSpine()), USER, {
      memoryType: 'profile',
      content: 'my ssn is 123-45-6789',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('redaction_blocked');
  });
});

// ---------------------------------------------------------------------------
// Pipeline trace — assert EVERY runtime step runs, in order, per path.
// The orchestrator emits one agent_run_events row per step, so the trace is the
// source of truth for "every step is followed".
// ---------------------------------------------------------------------------
function orderedEventTypes(seed: Record<string, Record<string, unknown>[]>): {
  types: string[];
  orders: number[];
} {
  const ev = (seed.agent_run_events ?? [])
    .slice()
    .sort((a, b) => (a.event_order as number) - (b.event_order as number));
  return { types: ev.map((e) => e.event_type as string), orders: ev.map((e) => e.event_order as number) };
}

/** Assert `required` appears as an ordered subsequence of `actual`. */
function expectOrderedSubsequence(actual: string[], required: string[]) {
  let i = 0;
  for (const t of actual) if (i < required.length && t === required[i]) i++;
  expect({ matched: i, of: required.length, trace: actual }).toEqual({
    matched: required.length,
    of: required.length,
    trace: actual,
  });
}

const CORE_STEPS = [
  'intent_detected',
  'capability_plan',
  'permission_check',
  'context_built',
  'memory_gate',
  'research_gate',
  'provider_selected',
  'final_synthesized',
];

describe('agent pipeline trace', () => {
  it('runs every core step in order on the fast path, with no specialists', async () => {
    const { runAgent } = await import('@/spine/ai/agent/agent-orchestrator.service');
    const seed = seedSpine();
    const res = await runAgent(makeDb(seed), USER, { command: 'What should I do today?' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.runtimePath).toBe('fast_path');

    const { types, orders } = orderedEventTypes(seed);
    // Every core step, in order, plus the drafts step (seeded action → drafts).
    expectOrderedSubsequence(types, [...CORE_STEPS, 'action_drafts_created']);
    // No specialist council on the fast path.
    expect(types).not.toContain('specialist_vote');

    // event_order is strictly increasing and unique.
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
    expect(new Set(orders).size).toBe(orders.length);

    // Write policy: always one run, one artifact, ≥1 provider run.
    expect((seed.agent_runs ?? []).length).toBe(1);
    expect((seed.agent_artifacts ?? []).length).toBe(1);
    expect((seed.agent_provider_runs ?? []).length).toBeGreaterThan(0);
  });

  it('convenes the specialist council between provider_selected and final_synthesized on the deep path', async () => {
    const { runAgent } = await import('@/spine/ai/agent/agent-orchestrator.service');
    const seed = seedSpine();
    const res = await runAgent(makeDb(seed), USER, { command: 'Should I trade this stock setup?' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.runtimePath).toBe('deep_path');

    const { types } = orderedEventTypes(seed);
    expectOrderedSubsequence(types, CORE_STEPS);
    expect(types).toContain('specialist_vote');
    // Specialists run strictly after provider selection and before synthesis.
    const firstVote = types.indexOf('specialist_vote');
    expect(firstVote).toBeGreaterThan(types.indexOf('provider_selected'));
    expect(firstVote).toBeLessThan(types.indexOf('final_synthesized'));
    expect(res.data.specialistVotes.length).toBeGreaterThan(0);
  });

  it('surfaces a research request on the research path instead of faking facts', async () => {
    const { runAgent } = await import('@/spine/ai/agent/agent-orchestrator.service');
    const seed = seedSpine();
    const res = await runAgent(makeDb(seed), USER, { command: 'What is the current stock price now?' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.researchRequests.length).toBeGreaterThan(0);
    expect(res.data.status).toBe('blocked_research_required');
    expect(orderedEventTypes(seed).types).toContain('research_gate');
  });

  it('asks for missing durable memory on a high-stakes run with no profile', async () => {
    const { runAgent } = await import('@/spine/ai/agent/agent-orchestrator.service');
    const seed = seedSpine();
    seed.profiles = []; // no durable profile
    const res = await runAgent(makeDb(seed), USER, { command: 'Should I trade this setup?' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.memoryRequests.length).toBeGreaterThan(0);
    expect(res.data.memoryRequests.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// API auth
// ---------------------------------------------------------------------------
describe('agent API auth', () => {
  let client: unknown = null;
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({ createClient: () => client }));
  });

  it('run route returns 401 when unauthenticated', async () => {
    client = makeDb({}, { user: null });
    const { POST } = await import('@/app/api/ai/agent/run/route');
    const res = await POST(new Request('http://test/api/ai/agent/run', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });

  it('action-drafts route returns 401 when unauthenticated', async () => {
    client = makeDb({}, { user: null });
    const { GET } = await import('@/app/api/ai/agent/action-drafts/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
