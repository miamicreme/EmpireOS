/**
 * AI intelligence-layer tests.
 *
 * The deterministic pieces (derived facts, trends, prioritizer, feedback) are
 * the accuracy backbone — they run with no model, so they're fully unit-tested.
 */
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeDerivedFacts,
  computeTrends,
} from '@/spine/ai/insight/derived-metrics.service';
import { prioritizeActions } from '@/spine/ai/insight/prioritizer.service';
import type {
  ContextAction,
  ModuleContextSlice,
  DerivedFacts,
} from '@/spine/ai/ai.types';
import type { ModuleMetric as SpineModuleMetric } from '@/spine/types';

vi.mock('@/spine/events/event.service', () => ({
  emitSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

const TODAY = '2026-06-30';
const NOW = '2026-06-30T12:00:00.000Z';

function metric(over: Partial<SpineModuleMetric>): SpineModuleMetric {
  return {
    id: 'm',
    user_id: 'u',
    module_id: 'cash-engine',
    metric_key: 'cash_today',
    metric_label: 'Cash Today',
    metric_value: 0,
    metric_text: null,
    target_value: null,
    unit: null,
    date: TODAY,
    trend_direction: null,
    metadata: {},
    created_at: NOW,
    ...over,
  };
}

function ctxAction(over: Partial<ContextAction> = {}): ContextAction {
  return {
    id: 'a',
    title: 'Action',
    category: 'general',
    priority: 'medium',
    status: 'open',
    rankScore: 50,
    dueAt: null,
    moduleId: null,
    phaseId: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Derived facts
// ---------------------------------------------------------------------------
describe('computeDerivedFacts', () => {
  it('computes the cash gap and hit percentage from live metrics', () => {
    const facts = computeDerivedFacts({
      liveMetrics: [metric({ metric_key: 'cash_today', metric_value: 90, target_value: 300 })],
      openActions: [],
      completedTodayCount: 0,
      redModuleCount: 0,
      dailyCashTarget: 300,
      today: TODAY,
      nowISO: NOW,
    });
    expect(facts.cashCollectedToday).toBe(90);
    expect(facts.cashTargetToday).toBe(300);
    expect(facts.cashGapToday).toBe(210);
    expect(facts.cashTargetHitPct).toBeCloseTo(0.3, 5);
  });

  it('counts overdue, due-today, and completion rate accurately', () => {
    const facts = computeDerivedFacts({
      liveMetrics: [],
      openActions: [
        ctxAction({ id: 'od', dueAt: '2020-01-01T00:00:00.000Z' }),
        ctxAction({ id: 'today', dueAt: `${TODAY}T18:00:00.000Z` }),
        ctxAction({ id: 'future', dueAt: '2099-01-01T00:00:00.000Z' }),
      ],
      completedTodayCount: 1,
      redModuleCount: 2,
      dailyCashTarget: null,
      today: TODAY,
      nowISO: NOW,
    });
    expect(facts.overdueActionCount).toBe(1);
    expect(facts.dueTodayActionCount).toBe(1);
    expect(facts.openActionCount).toBe(3);
    // done 1 / (done 1 + open 3) = 0.25
    expect(facts.completionRateToday).toBeCloseTo(0.25, 5);
    expect(facts.redModuleCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------
describe('computeTrends', () => {
  it('detects direction, delta, and a downward streak', () => {
    const rows: SpineModuleMetric[] = [
      metric({ metric_key: 'cash_today', metric_value: 300, date: '2026-06-27' }),
      metric({ metric_key: 'cash_today', metric_value: 200, date: '2026-06-28' }),
      metric({ metric_key: 'cash_today', metric_value: 120, date: '2026-06-29' }),
      metric({ metric_key: 'cash_today', metric_value: 80, date: '2026-06-30' }),
    ];
    const [trend] = computeTrends(rows);
    expect(trend?.current).toBe(80);
    expect(trend?.previous).toBe(120);
    expect(trend?.delta).toBe(-40);
    expect(trend?.direction).toBe('down');
    expect(trend?.streakDays).toBe(3); // 300->200->120->80, three down steps
  });

  it('returns flat when the latest value is unchanged', () => {
    const rows: SpineModuleMetric[] = [
      metric({ metric_value: 5, date: '2026-06-29' }),
      metric({ metric_value: 5, date: '2026-06-30' }),
    ];
    const [trend] = computeTrends(rows);
    expect(trend?.direction).toBe('flat');
    expect(trend?.streakDays).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Prioritizer
// ---------------------------------------------------------------------------
const EMPTY_DERIVED: DerivedFacts = {
  cashTargetToday: 300,
  cashCollectedToday: 0,
  cashGapToday: 300,
  cashTargetHitPct: 0,
  openActionCount: 0,
  overdueActionCount: 0,
  dueTodayActionCount: 0,
  completedTodayCount: 0,
  completionRateToday: null,
  followUpsDueCount: null,
  activeApplications: null,
  blockedProjects: null,
  openDisputes: null,
  redModuleCount: 0,
};

describe('prioritizeActions', () => {
  it('ranks an overdue, phase-aligned cash action above a quiet one', () => {
    const modules: ModuleContextSlice[] = [
      { moduleId: 'cash-engine', health: 'red', healthReason: 'behind', metrics: [] },
    ];
    const result = prioritizeActions({
      actions: [
        ctxAction({ id: 'quiet', category: 'admin', rankScore: 40 }),
        ctxAction({
          id: 'urgent',
          category: 'cash',
          moduleId: 'cash-engine',
          phaseId: 'phase_1',
          rankScore: 40,
          dueAt: '2020-01-01T00:00:00.000Z',
        }),
      ],
      currentPhase: 'phase_1',
      derived: EMPTY_DERIVED,
      modules,
      feedback: null,
      nowISO: NOW,
      today: TODAY,
    });
    expect(result[0]?.id).toBe('urgent');
    expect(result[0]?.priorityScore).toBe(100);
    expect(result[0]?.priorityReasons.join(' ')).toMatch(/overdue|cash gap|phase/);
  });

  it('penalizes categories the operator tends to skip', () => {
    const result = prioritizeActions({
      actions: [
        ctxAction({ id: 'pref', category: 'cash', rankScore: 30 }),
        ctxAction({ id: 'avoid', category: 'admin', rankScore: 30 }),
      ],
      currentPhase: null,
      derived: { ...EMPTY_DERIVED, cashGapToday: 0 },
      modules: [],
      feedback: {
        acceptedCount: 5,
        dismissedCount: 5,
        approvedDraftCount: 4,
        rejectedDraftCount: 4,
        preferredCategories: ['cash'],
        avoidedCategories: ['admin'],
        recentAccepted: [],
        recentDismissed: [],
      },
      nowISO: NOW,
      today: TODAY,
    });
    expect(result[0]?.id).toBe('pref');
  });
});

// ---------------------------------------------------------------------------
// Feedback summarization
// ---------------------------------------------------------------------------
function makeClient(tables: Record<string, unknown[]>): SupabaseClient {
  function chainFor(table: string) {
    const rows = tables[table] ?? [];
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    for (const m of ['select', 'eq', 'gte', 'order', 'limit']) chain[m] = ret;
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve);
    return chain;
  }
  return { from: (t: string) => chainFor(t) } as unknown as SupabaseClient;
}

describe('summarizeFeedback', () => {
  it('learns preferred and avoided categories from draft decisions', async () => {
    const { summarizeFeedback } = await import('@/spine/ai/insight/feedback.service');
    const client = makeClient({
      ai_recommendations: [
        { recommendation: 'Drive Uber', accepted_at: NOW, dismissed_at: null },
        { recommendation: 'File taxes', accepted_at: null, dismissed_at: NOW },
      ],
      ai_action_drafts: [
        { category: 'cash', status: 'approved' },
        { category: 'cash', status: 'approved' },
        { category: 'cash', status: 'approved' },
        { category: 'admin', status: 'rejected' },
        { category: 'admin', status: 'rejected' },
        { category: 'admin', status: 'rejected' },
      ],
    });
    const result = await summarizeFeedback(client, 'u');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.preferredCategories).toContain('cash');
    expect(result.data.avoidedCategories).toContain('admin');
    expect(result.data.acceptedCount).toBe(1);
    expect(result.data.dismissedCount).toBe(1);
  });

  it('ignores categories below the minimum sample size', async () => {
    const { summarizeFeedback } = await import('@/spine/ai/insight/feedback.service');
    const client = makeClient({
      ai_recommendations: [],
      ai_action_drafts: [{ category: 'cash', status: 'approved' }],
    });
    const result = await summarizeFeedback(client, 'u');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.preferredCategories).toEqual([]);
  });
});
