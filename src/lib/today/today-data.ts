import { computeDerivedFacts } from '@/spine/ai/insight/derived-metrics.service';
import { prioritizeActions } from '@/spine/ai/insight/prioritizer.service';
import { getLatestArtifactByType, getPendingDrafts, type AgentActionDraftRow, type ArtifactRow } from '@/spine/ai/agent/agent-repository.service';
import { getAllModuleMetrics, getModuleHealthSummary } from '@/spine/module-registry';
import { getRankedActions } from '@/spine/actions/action.service';
import { todayISODate, nowISO } from '@/lib/dates';
import type { GlobalAction, ModuleMetric, Profile } from '@/spine/types';
import type { ContextAction, DerivedFacts, ModuleContextSlice, PrioritizedAction } from '@/spine/ai/ai.types';

export interface TodayCommandData {
  userId: string | null;
  topActions: PrioritizedAction[];
  highestValueMove: PrioritizedAction | null;
  metrics: ModuleMetric[];
  derived: DerivedFacts;
  dailyBrief: ArtifactRow | null;
  pendingDrafts: AgentActionDraftRow[];
  jobPriority: PrioritizedAction | null;
  followUpPriority: PrioritizedAction | null;
  creditPriority: PrioritizedAction | null;
  projectPriority: PrioritizedAction | null;
  dealPriority: PrioritizedAction | null;
}

const emptyDerived: DerivedFacts = {
  cashTargetToday: 250,
  cashCollectedToday: null,
  cashGapToday: 250,
  cashTargetHitPct: null,
  overdueActionCount: 0,
  dueTodayActionCount: 0,
  openActionCount: 0,
  completedTodayCount: 0,
  completionRateToday: null,
  followUpsDueCount: 0,
  activeApplications: null,
  openDisputes: null,
  redModuleCount: 0,
  blockedProjects: null,
};

function pick(actions: PrioritizedAction[], category: GlobalAction['category']) {
  return actions.find((a) => a.category === category) ?? null;
}

export async function getTodayCommandData(): Promise<TodayCommandData> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { requireUserId } = await import('@/lib/security');
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return emptyToday();
    const userId = auth.data;

    const [profileResult, rankedResult, metricsResult, healthResult, briefResult, draftsResult] = await Promise.allSettled([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      getRankedActions(supabase, userId),
      getAllModuleMetrics(userId),
      getModuleHealthSummary(userId),
      getLatestArtifactByType(supabase, userId, 'daily_brief'),
      getPendingDrafts(supabase, userId),
    ]);

    const profile = profileResult.status === 'fulfilled' ? ((profileResult.value.data ?? null) as Profile | null) : null;
    const ranked = rankedResult.status === 'fulfilled' && rankedResult.value.ok ? rankedResult.value.data : [];
    const metrics = metricsResult.status === 'fulfilled' ? metricsResult.value : [];
    const health = healthResult.status === 'fulfilled' ? healthResult.value : [];
    const contextActions = ranked
      .filter((a) => a.status === 'open' || a.status === 'in_progress' || a.status === 'blocked')
      .map(toContextAction);
    const today = todayISODate();
    const now = nowISO();
    const modules: ModuleContextSlice[] = health.map((h) => ({
      moduleId: h.moduleId,
      health: h.health,
      healthReason: h.reason,
      metrics: metrics
        .filter((m) => m.module_id === h.moduleId)
        .slice(0, 5)
        .map((m) => ({ key: m.metric_key, label: m.metric_label, value: m.metric_value, text: m.metric_text, target: m.target_value, unit: m.unit })),
      signals: [],
    }));
    const derived = computeDerivedFacts({
      liveMetrics: metrics,
      openActions: contextActions,
      completedTodayCount: ranked.filter((a) => a.status === 'done' && a.completed_at?.slice(0, 10) === today).length,
      redModuleCount: health.filter((h) => h.health === 'red').length,
      dailyCashTarget: profile?.daily_cash_target ?? null,
      today,
      nowISO: now,
    });
    const prioritized = prioritizeActions({
      actions: contextActions,
      currentPhase: profile?.current_phase ?? null,
      derived,
      modules,
      feedback: null,
      nowISO: now,
      today,
    }).slice(0, 5);
    const dailyBrief = briefResult.status === 'fulfilled' && briefResult.value.ok ? briefResult.value.data : null;
    const pendingDrafts = draftsResult.status === 'fulfilled' && draftsResult.value.ok ? draftsResult.value.data : [];

    return {
      userId,
      topActions: prioritized,
      highestValueMove: prioritized[0] ?? null,
      metrics,
      derived,
      dailyBrief,
      pendingDrafts,
      jobPriority: pick(prioritized, 'job'),
      followUpPriority: pick(prioritized, 'followup'),
      creditPriority: pick(prioritized, 'credit'),
      projectPriority: pick(prioritized, 'project'),
      dealPriority: pick(prioritized, 'acquisition'),
    };
  } catch {
    return emptyToday();
  }
}

export function emptyToday(): TodayCommandData {
  return {
    userId: null,
    topActions: [],
    highestValueMove: null,
    metrics: [],
    derived: emptyDerived,
    dailyBrief: null,
    pendingDrafts: [],
    jobPriority: null,
    followUpPriority: null,
    creditPriority: null,
    projectPriority: null,
    dealPriority: null,
  };
}

function toContextAction(action: GlobalAction): ContextAction {
  return {
    id: action.id,
    title: action.title,
    category: action.category,
    priority: action.priority,
    status: action.status,
    rankScore: action.rank_score,
    dueAt: action.due_at,
    moduleId: action.module_id,
    phaseId: action.phase_id,
  };
}
