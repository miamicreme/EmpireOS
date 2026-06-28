/**
 * Module metrics tests — uses a chainable Supabase mock so no DB is needed.
 * Each module's getMetrics is tested by feeding it fake rows and checking the
 * returned ModuleMetric keys and values.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Chainable Supabase mock
// ---------------------------------------------------------------------------

/**
 * Returns a minimal SupabaseClient mock whose .from(table) chain resolves with
 * `{ data: responses[table] ?? [], error: null }` and supports .maybeSingle().
 */
function makeMock(responses: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      const rows = responses[table] ?? [];
      const chain: Record<string, unknown> = {};
      const asPromise = () => Promise.resolve({ data: rows, error: null });
      // All filter/select methods return the same chain
      for (const method of ['select', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'not', 'order', 'limit']) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
      // Make thenable so Promise.all / await work
      chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        asPromise().then(resolve, reject);
      chain.catch = (reject: (e: unknown) => unknown) => asPromise().catch(reject);
      return chain;
    },
  } as unknown as SupabaseClient;
}

const USER = 'user-test-123';

// ---------------------------------------------------------------------------
// cash-engine
// ---------------------------------------------------------------------------
describe('cash-engine getMetrics', () => {
  it('returns cash_today metric with correct net value', async () => {
    const { getMetrics } = await import('@/modules/cash-engine/metrics');
    const supabase = makeMock({
      cash_entries: [{ net_amount: 80 }, { net_amount: 120 }],
      profiles: [{ daily_cash_target: 300 }],
    });
    const metrics = await getMetrics(supabase, USER);
    const cashToday = metrics.find((m) => m.metric_key === 'cash_today');
    expect(cashToday).toBeDefined();
    expect(cashToday?.metric_value).toBe(200);
    expect(cashToday?.target_value).toBe(300);
  });

  it('uses 250 as default target when profile has no target', async () => {
    const { getMetrics } = await import('@/modules/cash-engine/metrics');
    const supabase = makeMock({
      cash_entries: [],
      profiles: [{}],
    });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics[0]?.target_value).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// job-hunt
// ---------------------------------------------------------------------------
describe('job-hunt getMetrics', () => {
  it('counts active applications (applied + interviewing + offer)', async () => {
    const { getMetrics } = await import('@/modules/job-hunt/metrics');
    const supabase = makeMock({
      job_applications: [
        { status: 'applied' },
        { status: 'interviewing' },
        { status: 'offer' },
        { status: 'saved' },
        { status: 'rejected' },
      ],
    });
    const metrics = await getMetrics(supabase, USER);
    const active = metrics.find((m) => m.metric_key === 'active_apps');
    expect(active?.metric_value).toBe(3);
  });

  it('counts interviewing separately', async () => {
    const { getMetrics } = await import('@/modules/job-hunt/metrics');
    const supabase = makeMock({
      job_applications: [
        { status: 'interviewing' },
        { status: 'interviewing' },
        { status: 'applied' },
      ],
    });
    const metrics = await getMetrics(supabase, USER);
    const interviewing = metrics.find((m) => m.metric_key === 'interviewing');
    expect(interviewing?.metric_value).toBe(2);
  });

  it('returns 0 counts for empty pipeline', async () => {
    const { getMetrics } = await import('@/modules/job-hunt/metrics');
    const supabase = makeMock({ job_applications: [] });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics.find((m) => m.metric_key === 'active_apps')?.metric_value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// followup-crm
// ---------------------------------------------------------------------------
describe('followup-crm getMetrics', () => {
  const pastDate = '2020-01-01T00:00:00.000Z';
  const futureDate = '2099-01-01T00:00:00.000Z';

  it('counts overdue follow-ups (next_follow_up_at in the past)', async () => {
    const { getMetrics } = await import('@/modules/followup-crm/metrics');
    const supabase = makeMock({
      contacts: [
        { next_follow_up_at: pastDate, status: 'active' },
        { next_follow_up_at: pastDate, status: 'active' },
        { next_follow_up_at: futureDate, status: 'active' },
        { next_follow_up_at: null, status: 'active' },
      ],
    });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics.find((m) => m.metric_key === 'followups_due')?.metric_value).toBe(2);
    expect(metrics.find((m) => m.metric_key === 'contacts_total')?.metric_value).toBe(4);
  });

  it('excludes archived contacts from due count', async () => {
    const { getMetrics } = await import('@/modules/followup-crm/metrics');
    const supabase = makeMock({
      contacts: [
        { next_follow_up_at: pastDate, status: 'archived' },
        { next_follow_up_at: pastDate, status: 'active' },
      ],
    });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics.find((m) => m.metric_key === 'followups_due')?.metric_value).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// credit-funding
// ---------------------------------------------------------------------------
describe('credit-funding getMetrics', () => {
  it('counts open disputes and completed items', async () => {
    const { getMetrics } = await import('@/modules/credit-funding/metrics');
    const supabase = makeMock({
      credit_items: [
        { status: 'disputing' },
        { status: 'disputing' },
        { status: 'open' },
        { status: 'resolved' },
      ],
    });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics.find((m) => m.metric_key === 'open_disputes')?.metric_value).toBe(2);
    expect(metrics.find((m) => m.metric_key === 'items_in_progress')?.metric_value).toBe(1);
    expect(metrics.find((m) => m.metric_key === 'items_complete')?.metric_value).toBe(1);
  });

  it('computes readiness score: resolved*100 + disputing*50 / eligible', async () => {
    const { getMetrics } = await import('@/modules/credit-funding/metrics');
    // 2 resolved (200) + 0 disputing + 0 open = 200 / 2 = 100
    const supabase = makeMock({
      credit_items: [{ status: 'resolved' }, { status: 'resolved' }],
    });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics.find((m) => m.metric_key === 'funding_readiness_score')?.metric_value).toBe(100);
  });

  it('score target is 70', async () => {
    const { getMetrics } = await import('@/modules/credit-funding/metrics');
    const supabase = makeMock({ credit_items: [] });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics.find((m) => m.metric_key === 'funding_readiness_score')?.target_value).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------
describe('projects getMetrics', () => {
  it('counts active and parked projects', async () => {
    const { getMetrics } = await import('@/modules/projects/metrics');
    const supabase = makeMock({
      projects: [
        { status: 'active', blocker: null },
        { status: 'active', blocker: null },
        { status: 'paused', blocker: null },
        { status: 'complete', blocker: null },
      ],
    });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics.find((m) => m.metric_key === 'active_projects')?.metric_value).toBe(2);
    expect(metrics.find((m) => m.metric_key === 'parked_projects')?.metric_value).toBe(1);
  });

  it('counts blocked projects (active + non-null blocker)', async () => {
    const { getMetrics } = await import('@/modules/projects/metrics');
    const supabase = makeMock({
      projects: [
        { status: 'active', blocker: 'Waiting on funding' },
        { status: 'active', blocker: null },
        { status: 'paused', blocker: 'Also blocked but paused' },
      ],
    });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics.find((m) => m.metric_key === 'blocked_projects')?.metric_value).toBe(1);
  });
});
