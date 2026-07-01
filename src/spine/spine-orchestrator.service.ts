/**
 * Spine Orchestrator. The top-level coordinator that assembles the command
 * dashboard: it pulls ranked actions, module health, metrics, and the Empire
 * Score into a single view. The Spine owns priority — ranking and scoring are
 * computed here, never trusted from clients.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type AppResult } from '@/lib/result';
import { todayISODate, tomorrowISODate } from '@/lib/dates';
import {
  getAllModuleMetrics,
  getModuleHealthSummary,
  syncAllModulesToSpine as registrySyncAll,
} from './module-registry';
import { getRankedActions } from './actions/action.service';
import {
  calculateEmpireScore,
  type EmpireScoreComponents,
} from './empire-score.service';
import type {
  EmpireScoreResult,
  GlobalAction,
  ModuleHealthResult,
  ModuleMetric,
} from './types';

export async function syncAllModulesToSpine(userId: string): Promise<void> {
  await registrySyncAll(userId);
}

export async function getTodayTopActions(
  supabase: SupabaseClient,
  userId: string,
  limit = 5,
): Promise<AppResult<GlobalAction[]>> {
  const ranked = await getRankedActions(supabase, userId);
  if (!ranked.ok) return ranked;
  return ok(ranked.data.slice(0, limit));
}

export async function getModuleHealth(
  userId: string,
): Promise<AppResult<ModuleHealthResult[]>> {
  return ok(await getModuleHealthSummary(userId));
}

/**
 * Derive Empire Score components from current data and compute the score.
 * Component ratios are intentionally simple in V3 and refined as modules mature.
 */
async function computeEmpireScore(
  supabase: SupabaseClient,
  userId: string,
  metrics: ModuleMetric[],
  rankedActions: GlobalAction[],
): Promise<EmpireScoreResult> {
  const cashToday = metrics.find((m) => m.metric_key === 'cash_today');
  const cashRatio =
    cashToday && cashToday.target_value
      ? (cashToday.metric_value ?? 0) / cashToday.target_value
      : 0;

  // Score today's execution: high/critical actions that are either open/blocked
  // (due today or overdue) OR completed today. Prior-day completed rows are
  // excluded so only today's work earns the 25% actions component.
  const today = todayISODate();
  const tomorrow = tomorrowISODate();
  // Predicate: include a row if it is due today-or-earlier (or has no due date)
  // OR it was completed today — so future-due actions finished today still earn
  // credit. The JS filter then drops done rows completed before today.
  const { data: allHighPriority, error: highPriorityError } = await supabase
    .from('global_actions')
    .select('status, completed_at')
    .eq('user_id', userId)
    .in('priority', ['high', 'critical'])
    .not('status', 'eq', 'archived')
    .or(`due_at.is.null,due_at.lt.${tomorrow},completed_at.gte.${today}`);
  // A transient query error would otherwise be indistinguishable from "no
  // high-priority actions" and silently report a 0 actions score.
  if (highPriorityError) {
    console.error('[spine-orchestrator] high-priority actions query failed:', highPriorityError.message);
  }
  const allHP = (allHighPriority ?? []).filter(
    (a) =>
      a.status !== 'done' ||
      (a.completed_at !== null && a.completed_at >= today),
  );
  const highDone = allHP.filter((a) => a.status === 'done').length;
  const actionsRatio = allHP.length > 0 ? highDone / allHP.length : 0;

  const activeApps = metrics.find((m) => m.metric_key === 'active_apps');
  const jobHuntRatio = activeApps
    ? Math.min(1, (activeApps.metric_value ?? 0) / 5)
    : 0;

  const followsDue = metrics.find((m) => m.metric_key === 'followups_due');
  const followUpsRatio = followsDue
    ? (followsDue.metric_value ?? 0) === 0
      ? 1
      : 0.5
    : 0;

  const { data: review } = await supabase
    .from('daily_reviews')
    .select('id')
    .eq('user_id', userId)
    .eq('date', todayISODate())
    .maybeSingle();
  const reviewRatio = review ? 1 : 0;

  const components: EmpireScoreComponents = {
    cashRatio,
    actionsRatio,
    jobHuntRatio,
    followUpsRatio,
    reviewRatio,
  };
  return calculateEmpireScore(components);
}

export interface CommandDashboardData {
  empireScore: EmpireScoreResult;
  topActions: GlobalAction[];
  moduleHealth: ModuleHealthResult[];
  metrics: ModuleMetric[];
}

export async function getCommandDashboardData(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<CommandDashboardData>> {
  const [metrics, health, rankedRes] = await Promise.all([
    getAllModuleMetrics(userId),
    getModuleHealthSummary(userId),
    getRankedActions(supabase, userId),
  ]);

  if (!rankedRes.ok) return rankedRes;
  const ranked = rankedRes.data;
  const empireScore = await computeEmpireScore(supabase, userId, metrics, ranked);

  return ok({
    empireScore,
    topActions: ranked.slice(0, 5),
    moduleHealth: health,
    metrics,
  });
}
