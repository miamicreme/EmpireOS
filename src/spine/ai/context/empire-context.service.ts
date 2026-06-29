/**
 * Empire Context Engine.
 *
 * Gathers everything the AI Chief of Staff needs into one typed EmpireContext:
 * profile, phase, empire score, top/overdue actions, per-module health +
 * metrics, recent decisions, and the current daily/weekly reviews.
 *
 * This is the most important V2 primitive: every AI feature reads this object
 * (after redaction) and nothing else. It degrades gracefully — any failing
 * source yields an empty slice rather than failing the whole build.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type AppResult } from '@/lib/result';
import { todayISODate, nowISO } from '@/lib/dates';
import { calculateEmpireScore } from '../../empire-score.service';
import { getModuleHealthSummary, getAllModuleMetrics } from '../../module-registry';
import { MODULE_IDS } from '../../constants';
import type {
  Profile,
  GlobalAction,
  Decision,
  DailyReview,
  WeeklyReview,
  ModuleMetric,
  ModuleHealthResult,
} from '../../types';
import type {
  EmpireContext,
  ContextAction,
  ModuleContextSlice,
  ContextDecision,
} from '../ai.types';

function toContextAction(a: GlobalAction): ContextAction {
  return {
    id: a.id,
    title: a.title,
    category: a.category,
    priority: a.priority,
    status: a.status,
    rankScore: a.rank_score,
    dueAt: a.due_at,
    moduleId: a.module_id,
  };
}

function isOverdue(a: GlobalAction, now: string): boolean {
  return Boolean(a.due_at && a.due_at < now && a.status !== 'done' && a.status !== 'archived');
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

/**
 * Build the full EmpireContext for a user. Always returns ok() — individual
 * sources are isolated so one failure can't blank the whole context.
 */
export async function buildEmpireContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<EmpireContext>> {
  const today = todayISODate();
  const now = nowISO();

  const [profileRow, actions, decisions, daily, weekly, health, metrics] =
    await Promise.all([
      safe(fetchProfile(supabase, userId), null),
      safe(fetchOpenActions(supabase, userId), [] as GlobalAction[]),
      safe(fetchRecentDecisions(supabase, userId), [] as Decision[]),
      safe(fetchDailyReview(supabase, userId, today), null as DailyReview | null),
      safe(fetchWeeklyReview(supabase, userId), null as WeeklyReview | null),
      safe(getModuleHealthSummary(userId), [] as ModuleHealthResult[]),
      safe(getAllModuleMetrics(userId), [] as ModuleMetric[]),
    ]);

  const overdueActions = actions.filter((a) => isOverdue(a, now)).map(toContextAction);
  const topActions = [...actions]
    .sort((a, b) => (b.rank_score ?? 0) - (a.rank_score ?? 0))
    .slice(0, 10)
    .map(toContextAction);

  const modules = buildModuleSlices(health, metrics);
  const empireScore = computeEmpireScore(actions, health, daily);

  const context: EmpireContext = {
    generatedFor: today,
    profile: profileRow
      ? {
          fullName: profileRow.full_name,
          currentPhase: profileRow.current_phase,
          dailyCashTarget: profileRow.daily_cash_target,
          weeklyCashTarget: profileRow.weekly_cash_target,
          monthlyCashTarget: profileRow.monthly_cash_target,
          riskTolerance: profileRow.risk_tolerance,
          primaryGoal: profileRow.primary_goal,
        }
      : null,
    empireScore: empireScore
      ? { score: empireScore.score, grade: empireScore.grade }
      : null,
    topActions,
    overdueActions,
    modules,
    recentDecisions: decisions.map(toContextDecision),
    dailyReview: daily
      ? {
          date: daily.date,
          empireScore: daily.empire_score,
          cashToday: daily.cash_today,
          wins: daily.wins,
          blockers: daily.blockers,
        }
      : null,
    weeklyReview: weekly
      ? {
          weekStart: weekly.week_start,
          cashTotal: weekly.cash_total,
          cashTarget: weekly.cash_target,
          highlights: weekly.highlights,
        }
      : null,
  };

  return ok(context);
}

function buildModuleSlices(
  health: ModuleHealthResult[],
  metrics: ModuleMetric[],
): ModuleContextSlice[] {
  const healthByModule = new Map(health.map((h) => [h.moduleId, h]));
  return MODULE_IDS.map((moduleId) => {
    const h = healthByModule.get(moduleId);
    const moduleMetrics = metrics
      .filter((m) => m.module_id === moduleId)
      .map((m) => ({
        key: m.metric_key,
        label: m.metric_label,
        value: m.metric_value,
        text: m.metric_text,
        target: m.target_value,
        unit: m.unit,
      }));
    return {
      moduleId,
      health: h?.health ?? 'red',
      healthReason: h?.reason ?? 'No data',
      metrics: moduleMetrics,
    };
  });
}

function computeEmpireScore(
  actions: GlobalAction[],
  health: ModuleHealthResult[],
  daily: DailyReview | null,
) {
  if (actions.length === 0 && health.length === 0) return null;
  const healthRatio = (id: string) => {
    const h = health.find((x) => x.moduleId === id)?.health ?? 'red';
    return h === 'green' ? 1 : h === 'yellow' ? 0.5 : 0;
  };
  const done = actions.filter((a) => a.status === 'done').length;
  const actionsRatio = actions.length > 0 ? done / actions.length : 0;
  return calculateEmpireScore({
    cashRatio: healthRatio('cash-engine'),
    actionsRatio: Math.min(1, actionsRatio + (actions.length > done ? 0.3 : 0)),
    jobHuntRatio: healthRatio('job-hunt'),
    followUpsRatio: healthRatio('followup-crm'),
    reviewRatio: daily ? 1 : 0,
  });
}

function toContextDecision(d: Decision): ContextDecision {
  return {
    id: d.id,
    title: d.title,
    question: d.question,
    status: d.status,
    recommendation: d.recommendation,
    confidence: d.confidence,
  };
}

// ---------------------------------------------------------------------------
// Source fetchers (RLS-scoped through the passed client)
// ---------------------------------------------------------------------------
async function fetchProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return (data ?? null) as Profile | null;
}

async function fetchOpenActions(supabase: SupabaseClient, userId: string): Promise<GlobalAction[]> {
  const { data } = await supabase
    .from('global_actions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['open', 'in_progress', 'blocked'])
    .order('rank_score', { ascending: false })
    .limit(50);
  return (data ?? []) as GlobalAction[];
}

async function fetchRecentDecisions(supabase: SupabaseClient, userId: string): Promise<Decision[]> {
  const { data } = await supabase
    .from('decisions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);
  return (data ?? []) as Decision[];
}

async function fetchDailyReview(
  supabase: SupabaseClient,
  userId: string,
  date: string,
): Promise<DailyReview | null> {
  const { data } = await supabase
    .from('daily_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  return (data ?? null) as DailyReview | null;
}

async function fetchWeeklyReview(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeeklyReview | null> {
  const { data } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as WeeklyReview | null;
}
