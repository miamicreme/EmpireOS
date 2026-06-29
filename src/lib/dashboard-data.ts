/**
 * Server-side data fetching for the dashboard. Wraps service calls with
 * graceful empty-state returns so pages render even without Supabase configured.
 */
import type { GlobalAction, Decision, ModuleHealthResult, EmpireScoreResult } from '@/spine/types';
import { calculateEmpireScore } from '@/spine/empire-score.service';

export interface DashboardData {
  empireScore: EmpireScoreResult | null;
  moduleHealth: ModuleHealthResult[];
  actions: GlobalAction[];
  decisions: Decision[];
  userId: string | null;
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { requireUserId } = await import('@/lib/security');
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return emptyDashboard();

    const userId = auth.data;

    const [actionsResult, decisionsResult, healthResults] = await Promise.allSettled([
      getActions(supabase, userId),
      getDecisions(supabase, userId),
      getHealth(userId),
    ]);

    const actions = actionsResult.status === 'fulfilled' ? actionsResult.value : [];
    const decisions = decisionsResult.status === 'fulfilled' ? decisionsResult.value : [];
    const moduleHealth = healthResults.status === 'fulfilled' ? healthResults.value : [];

    const empireScore = await computeEmpireScoreFromData(actions, moduleHealth);

    return { empireScore, moduleHealth, actions, decisions, userId };
  } catch {
    return emptyDashboard();
  }
}

async function getActions(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
): Promise<GlobalAction[]> {
  const { getRankedActions } = await import('@/spine/actions/action.service');
  const result = await getRankedActions(supabase, userId);
  return result.ok ? result.data : [];
}

async function getDecisions(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
): Promise<Decision[]> {
  const { data } = await supabase
    .from('decisions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as Decision[];
}

async function getHealth(userId: string): Promise<ModuleHealthResult[]> {
  const { getModuleHealthSummary } = await import('@/spine/module-registry');
  return getModuleHealthSummary(userId);
}

async function computeEmpireScoreFromData(
  actions: GlobalAction[],
  health: ModuleHealthResult[],
): Promise<EmpireScoreResult | null> {
  if (actions.length === 0 && health.length === 0) return null;

  const cashHealth = health.find((h) => h.moduleId === 'cash-engine')?.health ?? 'red';
  const jobHealth = health.find((h) => h.moduleId === 'job-hunt')?.health ?? 'red';
  const followHealth = health.find((h) => h.moduleId === 'followup-crm')?.health ?? 'red';

  const openActions = actions.filter((a) => a.status === 'open' || a.status === 'in_progress');
  const doneActions = actions.filter((a) => a.status === 'done');
  const actionsRatio = actions.length > 0 ? doneActions.length / Math.max(actions.length, 1) : 0;

  return calculateEmpireScore({
    cashRatio: cashHealth === 'green' ? 1 : cashHealth === 'yellow' ? 0.5 : 0,
    actionsRatio: Math.min(1, actionsRatio + (openActions.length > 0 ? 0.3 : 0)),
    jobHuntRatio: jobHealth === 'green' ? 1 : jobHealth === 'yellow' ? 0.5 : 0,
    followUpsRatio: followHealth === 'green' ? 1 : followHealth === 'yellow' ? 0.5 : 0,
    reviewRatio: 0,
  });
}

function emptyDashboard(): DashboardData {
  return { empireScore: null, moduleHealth: [], actions: [], decisions: [], userId: null };
}
