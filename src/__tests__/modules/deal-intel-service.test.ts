/**
 * deal-intel service.ts — DB-error handling and ModuleContract metrics/health.
 *
 * Regression coverage for two fixes: enrichment-write failures in
 * createDealFromRawInput/runDealAnalysis must surface (not be silently
 * swallowed), and getMetrics/getHealth must reflect real queried state instead
 * of a hardcoded stub.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

function withId(row: Record<string, unknown> | null) {
  return row ? { id: 'gen-id', created_at: 't', updated_at: 't', ...row } : null;
}

function makeClient(
  tables: Record<string, Record<string, unknown>[]>,
  opts: { tableErrors?: Record<string, { message: string }> } = {},
): SupabaseClient {
  const tableErrors = opts.tableErrors ?? {};

  function chainFor(table: string) {
    const rows = tables[table] ?? [];
    const tableError = tableErrors[table] ?? null;
    let inserted: Record<string, unknown>[] | null = null;
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.insert = (payload: Record<string, unknown> | Record<string, unknown>[]) => {
      inserted = Array.isArray(payload) ? payload : [payload];
      return chain;
    };
    chain.update = () => chain;
    chain.delete = () => chain;
    for (const m of ['eq', 'in', 'is', 'order', 'limit', 'gte', 'gt', 'lt', 'neq']) {
      chain[m] = () => chain;
    }
    chain.single = () =>
      Promise.resolve({ data: tableError ? null : withId(inserted?.[0] ?? rows[0] ?? null), error: tableError });
    chain.maybeSingle = () =>
      Promise.resolve({ data: tableError ? null : withId(inserted?.[0] ?? rows[0] ?? null), error: tableError });
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: tableError ? null : (inserted ?? rows), error: tableError }).then(resolve);
    return chain;
  }

  return { from: (t: string) => chainFor(t) } as unknown as SupabaseClient;
}

const USER = 'user-1';

describe('createDealFromRawInput', () => {
  it('still creates the deal but reports a warning when an enrichment insert fails', async () => {
    const { createDealFromRawInput } = await import('@/modules/deal-intel/service');
    const client = makeClient(
      { deal_intel_deals: [] },
      { tableErrors: { deal_intel_assets: { message: 'insert failed' } } },
    );
    const result = await createDealFromRawInput(client, USER, {
      title: 'Miami Laundromat',
      deal_type: 'acquire',
      objective: 'acquire_and_operate',
      raw_input: 'Asking price $1.2M. Revenue $650,000.',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deal_id).toBeTruthy();
    expect(result.data.warnings).toContain('Could not save the primary asset record.');
  });

  it('aborts entirely when the primary deal insert fails', async () => {
    const { createDealFromRawInput } = await import('@/modules/deal-intel/service');
    const client = makeClient({}, { tableErrors: { deal_intel_deals: { message: 'insert failed' } } });
    const result = await createDealFromRawInput(client, USER, {
      title: 'Miami Laundromat',
      deal_type: 'acquire',
      objective: 'acquire_and_operate',
      raw_input: 'Asking price $1.2M.',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('db_error');
  });
});

describe('runDealAnalysis', () => {
  it('aborts when the analysis-run row cannot be created', async () => {
    const { runDealAnalysis } = await import('@/modules/deal-intel/service');
    const client = makeClient(
      { deal_intel_deals: [{ id: 'deal-1', title: 'Miami Laundromat', summary: 'test' }] },
      { tableErrors: { deal_intel_agent_runs: { message: 'insert failed' } } },
    );
    const result = await runDealAnalysis(client, 'deal-1', {
      analysis_depth: 'full',
      objective: 'acquire_and_operate',
      run_research: true,
      generate_visual_payload: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('db_error');
  });
});

describe('deal-intel getMetrics/getHealth', () => {
  it('reports yellow health with zero metrics when no deals are tracked', async () => {
    const { getMetrics, getHealth } = await import('@/modules/deal-intel/service');
    const client = makeClient({ deal_intel_deals: [] });
    const health = await getHealth(client, USER);
    expect(health.health).toBe('yellow');
    const metrics = await getMetrics(client, USER);
    expect(metrics.find((m) => m.metric_key === 'total_deals')?.metric_value).toBe(0);
  });

  it('reports red health when a tracked deal has a failed analysis run', async () => {
    const { getHealth } = await import('@/modules/deal-intel/service');
    const client = makeClient({
      deal_intel_deals: [{ id: 'deal-1', status: 'created' }],
      deal_intel_agent_runs: [{ id: 'run-1' }],
    });
    const health = await getHealth(client, USER);
    expect(health.health).toBe('red');
  });
});
