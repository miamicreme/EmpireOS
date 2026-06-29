/**
 * AI V2 tests.
 *
 * Cover the V2 execution layer without any external dependency:
 *   - EmpireContext builder ranking + overdue detection
 *   - redaction gate fires before any AI call (even in stub mode)
 *   - daily brief + chief-of-staff generate in stub mode (no provider key)
 *   - action draft approval converts a draft into a real global_action
 *   - module copilot routing rejects unknown modules
 *   - API routes enforce auth
 *
 * A table-keyed Supabase mock lets each query resolve with table-specific rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// emitSystemEvent is fire-and-forget; stub so action creates don't need a table.
vi.mock('@/spine/events/event.service', () => ({
  emitSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Table-keyed Supabase mock
// ---------------------------------------------------------------------------
function makeClient(
  tables: Record<string, unknown[]>,
  opts: { user?: { id: string } | null } = {},
): SupabaseClient {
  const user = opts.user === undefined ? { id: 'user-1' } : opts.user;

  function chainFor(table: string) {
    const rows = tables[table] ?? [];
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    for (const m of [
      'select', 'eq', 'in', 'is', 'neq', 'gt', 'lt', 'gte', 'lte', 'not',
      'order', 'limit', 'insert', 'update', 'upsert', 'delete',
    ]) {
      chain[m] = ret;
    }
    chain.single = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    chain.catch = () => chain;
    return chain;
  }

  return {
    auth: {
      getUser: () =>
        Promise.resolve(
          user
            ? { data: { user }, error: null }
            : { data: { user: null }, error: { message: 'no user' } },
        ),
    },
    from: (table: string) => chainFor(table),
  } as unknown as SupabaseClient;
}

const USER = 'user-1';
const TODAY = new Date().toISOString().slice(0, 10);

function action(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    user_id: USER,
    module_id: 'cash-engine',
    phase_id: null,
    title: 'Drive 4 hours',
    description: null,
    category: 'cash',
    status: 'open',
    priority: 'high',
    due_at: null,
    completed_at: null,
    impact_score: 7,
    urgency_score: 6,
    effort_score: 4,
    confidence_score: 0.7,
    empire_score_weight: 1,
    rank_score: 50,
    source_type: 'manual',
    source_id: null,
    metadata: {},
    created_at: TODAY,
    updated_at: TODAY,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// EmpireContext builder
// ---------------------------------------------------------------------------
describe('buildEmpireContext', () => {
  it('ranks top actions by rank_score and flags overdue', async () => {
    const { buildEmpireContext } = await import('@/spine/ai/context/empire-context.service');
    const yesterday = '2020-01-01T00:00:00.000Z';
    const client = makeClient({
      profiles: [{ id: USER, full_name: 'K', current_phase: 'phase_1', daily_cash_target: 300, weekly_cash_target: 1500, monthly_cash_target: 6000, risk_tolerance: 'balanced', primary_goal: 'Empire' }],
      global_actions: [
        action({ id: 'low', rank_score: 10 }),
        action({ id: 'high', rank_score: 90 }),
        action({ id: 'od', rank_score: 20, due_at: yesterday }),
      ],
      decisions: [],
      daily_reviews: [],
      weekly_reviews: [],
    });

    const result = await buildEmpireContext(client, USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.topActions[0]?.id).toBe('high');
    expect(result.data.overdueActions.map((a) => a.id)).toContain('od');
    expect(result.data.profile?.dailyCashTarget).toBe(300);
  });

  it('degrades gracefully with no data', async () => {
    const { buildEmpireContext } = await import('@/spine/ai/context/empire-context.service');
    const client = makeClient({});
    const result = await buildEmpireContext(client, USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.topActions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Redaction gate
// ---------------------------------------------------------------------------
describe('runStructured redaction gate', () => {
  it('redacts PII and secrets in the context object before any call', async () => {
    const { redactObject } = await import('@/spine/ai/redaction');
    const out = redactObject({ ssn: '123-45-6789', email: 'k@example.com', clean: 'ok' });
    expect(JSON.stringify(out)).not.toContain('123-45-6789');
    expect(JSON.stringify(out)).not.toContain('k@example.com');
    expect(out.clean).toBe('ok');
  });

  it('returns the stub when no provider key is configured', async () => {
    const { runStructured } = await import('@/spine/ai/ai-runner');
    const { z } = await import('zod');
    const out = await runStructured({
      feature: 'test',
      systemPrompt: 'x',
      instruction: 'plan',
      context: { note: 'clean' },
      schema: z.object({ value: z.string() }),
      stub: { value: 'STUB' },
    });
    expect(out.provider).toBe('stub');
    expect(out.data).toEqual({ value: 'STUB' });
  });
});

// ---------------------------------------------------------------------------
// Daily brief + chief of staff in stub mode
// ---------------------------------------------------------------------------
describe('generation in stub mode', () => {
  it('generateDailyBrief returns a brief without persisting', async () => {
    const { generateDailyBrief } = await import('@/spine/ai/daily-brief.service');
    const client = makeClient({
      profiles: [{ id: USER, full_name: 'K', current_phase: 'phase_1', daily_cash_target: 250, weekly_cash_target: 1500, monthly_cash_target: 6000, risk_tolerance: 'balanced', primary_goal: 'Empire' }],
      global_actions: [action()],
      decisions: [],
      daily_reviews: [],
      weekly_reviews: [],
    });
    const result = await generateDailyBrief(client, USER, { persist: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.saved).toBeNull();
    expect(result.data.brief.cashTarget).toBe(250);
  });

  it('runChiefOfStaff returns ranked actions without persisting', async () => {
    const { runChiefOfStaff } = await import('@/spine/ai/chief-of-staff.service');
    const client = makeClient({
      profiles: [{ id: USER, daily_cash_target: 250, weekly_cash_target: 1500, monthly_cash_target: 6000, current_phase: 'phase_1', risk_tolerance: 'balanced', primary_goal: 'Empire', full_name: null }],
      global_actions: [action()],
      decisions: [],
      daily_reviews: [],
      weekly_reviews: [],
    });
    const result = await runChiefOfStaff(client, USER, { persist: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.output.topActions.length).toBeGreaterThan(0);
    expect(result.data.drafts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Action draft approval
// ---------------------------------------------------------------------------
describe('approveActionDraft', () => {
  it('converts a pending draft into a real global_action', async () => {
    const { approveActionDraft } = await import('@/spine/ai/action-draft.service');
    const draft = {
      id: 'd1',
      user_id: USER,
      recommendation_id: null,
      module_id: 'cash-engine',
      title: 'Call lender',
      description: null,
      category: 'general',
      priority: 'medium',
      due_at: null,
      impact_score: 5,
      urgency_score: 5,
      effort_score: 5,
      confidence_score: 0.5,
      status: 'pending',
      approved_at: null,
      rejected_at: null,
      created_action_id: null,
      metadata: {},
      created_at: TODAY,
    };
    const client = makeClient({
      ai_action_drafts: [draft],
      global_actions: [action({ id: 'created-1', title: 'Call lender', source_type: 'ai_draft' })],
    });
    const result = await approveActionDraft(client, USER, 'd1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.action.id).toBe('created-1');
  });

  it('refuses to approve a rejected draft', async () => {
    const { approveActionDraft } = await import('@/spine/ai/action-draft.service');
    const client = makeClient({
      ai_action_drafts: [{ id: 'd2', user_id: USER, status: 'rejected', category: 'general', priority: 'medium', impact_score: 5, urgency_score: 5, effort_score: 5, confidence_score: 0.5, title: 'x', description: null, module_id: null, due_at: null, created_action_id: null }],
    });
    const result = await approveActionDraft(client, USER, 'd2');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_state');
  });

  it('refuses to reject an approved draft', async () => {
    const { rejectActionDraft } = await import('@/spine/ai/action-draft.service');
    const client = makeClient({
      ai_action_drafts: [{ id: 'd3', user_id: USER, status: 'approved', category: 'general', priority: 'medium', impact_score: 5, urgency_score: 5, effort_score: 5, confidence_score: 0.5, title: 'x', description: null, module_id: null, due_at: null, created_action_id: 'act-1' }],
    });
    const result = await rejectActionDraft(client, USER, 'd3');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_state');
  });
});

// ---------------------------------------------------------------------------
// Ask input persistence default — action-oriented callers persist by default
// ---------------------------------------------------------------------------
describe('askInputSchema persist default', () => {
  it('defaults persist to true so decision questions create drafts', async () => {
    const { askInputSchema } = await import('@/spine/ai/ai.schemas');
    expect(askInputSchema.parse({ question: 'Uber or jobs?' }).persist).toBe(true);
  });

  it('honors an explicit persist:false (exploratory chat)', async () => {
    const { askInputSchema } = await import('@/spine/ai/ai.schemas');
    expect(askInputSchema.parse({ question: 'hi', persist: false }).persist).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Module copilot routing
// ---------------------------------------------------------------------------
describe('runModuleCopilot routing', () => {
  it('rejects an unknown module id', async () => {
    const { runModuleCopilot } = await import('@/spine/ai/module-copilot.service');
    const client = makeClient({});
    const result = await runModuleCopilot(client, USER, 'not-a-module', { persist: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
  });

  it('runs a known module in stub mode', async () => {
    const { runModuleCopilot } = await import('@/spine/ai/module-copilot.service');
    const client = makeClient({
      profiles: [{ id: USER, daily_cash_target: 250, weekly_cash_target: 1500, monthly_cash_target: 6000, current_phase: 'phase_1', risk_tolerance: 'balanced', primary_goal: 'Empire', full_name: null }],
      global_actions: [],
      decisions: [],
      daily_reviews: [],
      weekly_reviews: [],
    });
    const result = await runModuleCopilot(client, USER, 'cash-engine', { persist: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.output.moduleId).toBe('cash-engine');
  });
});

// ---------------------------------------------------------------------------
// API auth protection
// ---------------------------------------------------------------------------
describe('AI API auth enforcement', () => {
  let currentClient: unknown = null;

  beforeEach(() => {
    currentClient = null;
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({ createClient: () => currentClient }));
  });

  it('brief GET returns 401 when unauthenticated', async () => {
    currentClient = makeClient({}, { user: null });
    const { GET } = await import('@/app/api/ai/brief/route');
    const res = await GET(new Request('http://test/api/ai/brief'));
    expect(res.status).toBe(401);
  });

  it('chief-of-staff POST returns 401 when unauthenticated', async () => {
    currentClient = makeClient({}, { user: null });
    const { POST } = await import('@/app/api/ai/chief-of-staff/route');
    const res = await POST(
      new Request('http://test/api/ai/chief-of-staff', { method: 'POST', body: '{}' }),
    );
    expect(res.status).toBe(401);
  });

  it('action-drafts GET returns 401 when unauthenticated', async () => {
    currentClient = makeClient({}, { user: null });
    const { GET } = await import('@/app/api/ai/action-drafts/route');
    const res = await GET(new Request('http://test/api/ai/action-drafts'));
    expect(res.status).toBe(401);
  });
});
