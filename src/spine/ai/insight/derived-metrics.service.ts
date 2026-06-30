/**
 * Derived metrics + trends.
 *
 * Accuracy first: the model is bad at arithmetic over a JSON blob, so every
 * number that matters (cash gap, overdue count, completion rate, momentum) is
 * computed here in code and handed to the AI as authoritative facts it must not
 * re-derive. Pure functions — no IO, fully unit-testable.
 */
import type { GlobalAction, ModuleMetric } from '../../types';
import type { DerivedFacts, MetricTrend, ContextAction } from '../ai.types';

function metricValue(metrics: ModuleMetric[], key: string): number | null {
  const m = metrics.find((x) => x.metric_key === key);
  return m?.metric_value ?? null;
}

function metricTarget(metrics: ModuleMetric[], key: string): number | null {
  const m = metrics.find((x) => x.metric_key === key);
  return m?.target_value ?? null;
}

function isDueToday(dueAt: string | null, today: string): boolean {
  return Boolean(dueAt && dueAt.slice(0, 10) === today);
}

function isOverdue(action: Pick<ContextAction, 'dueAt' | 'status'>, nowISO: string): boolean {
  return Boolean(
    action.dueAt &&
      action.dueAt < nowISO &&
      action.status !== 'done' &&
      action.status !== 'archived',
  );
}

export interface DerivedInputs {
  liveMetrics: ModuleMetric[];
  openActions: ContextAction[];
  completedTodayCount: number;
  redModuleCount: number;
  dailyCashTarget: number | null;
  today: string;
  nowISO: string;
}

/** Compute the authoritative derived facts from already-gathered inputs. */
export function computeDerivedFacts(input: DerivedInputs): DerivedFacts {
  const {
    liveMetrics,
    openActions,
    completedTodayCount,
    redModuleCount,
    dailyCashTarget,
    today,
    nowISO,
  } = input;

  const cashCollectedToday = metricValue(liveMetrics, 'cash_today');
  const cashTargetToday = metricTarget(liveMetrics, 'cash_today') ?? dailyCashTarget;

  const cashGapToday =
    cashTargetToday != null && cashCollectedToday != null
      ? Math.max(0, round2(cashTargetToday - cashCollectedToday))
      : cashTargetToday != null
        ? cashTargetToday
        : null;

  const cashTargetHitPct =
    cashTargetToday && cashTargetToday > 0 && cashCollectedToday != null
      ? clamp01(round2(cashCollectedToday / cashTargetToday))
      : null;

  const openActionCount = openActions.length;
  const overdueActionCount = openActions.filter((a) => isOverdue(a, nowISO)).length;
  const dueTodayActionCount = openActions.filter((a) => isDueToday(a.dueAt, today)).length;

  const totalForRate = completedTodayCount + openActionCount;
  const completionRateToday =
    totalForRate > 0 ? round2(completedTodayCount / totalForRate) : null;

  return {
    cashTargetToday: cashTargetToday ?? null,
    cashCollectedToday,
    cashGapToday,
    cashTargetHitPct,
    openActionCount,
    overdueActionCount,
    dueTodayActionCount,
    completedTodayCount,
    completionRateToday,
    followUpsDueCount: metricValue(liveMetrics, 'followups_due'),
    activeApplications: metricValue(liveMetrics, 'active_apps'),
    blockedProjects: metricValue(liveMetrics, 'blocked_projects'),
    openDisputes: metricValue(liveMetrics, 'open_disputes'),
    redModuleCount,
  };
}

/**
 * Compute per-metric trends from historical rows. Rows may span many metric
 * keys; they're grouped by (moduleId, key) and ordered by date ascending.
 */
export function computeTrends(rows: ModuleMetric[]): MetricTrend[] {
  const byKey = new Map<string, ModuleMetric[]>();
  for (const row of rows) {
    if (row.metric_value == null) continue;
    const k = `${row.module_id ?? 'spine'}::${row.metric_key}`;
    const list = byKey.get(k) ?? [];
    list.push(row);
    byKey.set(k, list);
  }

  const trends: MetricTrend[] = [];
  for (const list of byKey.values()) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) continue;
    const last = sorted[sorted.length - 1]!;
    const prev = sorted.length > 1 ? sorted[sorted.length - 2]! : null;
    const current = last.metric_value;
    const previous = prev?.metric_value ?? null;
    const delta =
      current != null && previous != null ? round2(current - previous) : null;
    const direction: MetricTrend['direction'] =
      delta == null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';

    trends.push({
      moduleId: last.module_id,
      key: last.metric_key,
      label: last.metric_label,
      current,
      previous,
      delta,
      direction,
      streakDays: streakLength(sorted),
      samples: sorted.length,
    });
  }
  return trends;
}

/** Count consecutive trailing days the value moved the same direction. */
function streakLength(sortedAsc: ModuleMetric[]): number {
  if (sortedAsc.length < 2) return 0;
  const dirAt = (i: number): number => {
    const a = sortedAsc[i - 1]!.metric_value;
    const b = sortedAsc[i]!.metric_value;
    if (a == null || b == null || a === b) return 0;
    return b > a ? 1 : -1;
  };
  const lastDir = dirAt(sortedAsc.length - 1);
  if (lastDir === 0) return 0;
  let streak = 1;
  for (let i = sortedAsc.length - 2; i >= 1; i--) {
    if (dirAt(i) === lastDir) streak++;
    else break;
  }
  return streak;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Helper to count today's completed actions from raw rows (used by the engine). */
export function countCompletedToday(actions: GlobalAction[]): number {
  return actions.filter((a) => a.status === 'done').length;
}
