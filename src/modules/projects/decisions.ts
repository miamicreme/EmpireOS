import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project, DecisionContext } from '@/spine/types';
import { manifest } from './manifest';

export async function getDecisionContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecisionContext> {
  const { data } = await supabase
    .from('projects')
    .select('name, status, blocker, next_action')
    .eq('user_id', userId)
    .eq('status', 'active');

  const projects = (data ?? []) as Pick<Project, 'name' | 'status' | 'blocker' | 'next_action'>[];
  const blocked = projects.filter((p) => p.blocker !== null).length;

  return {
    moduleId: manifest.id,
    summary: `${projects.length} active projects, ${blocked} blocked.`,
    facts: {
      activeCount: projects.length,
      blockedCount: blocked,
    },
    risks: projects.length > 5 ? ['Too many active projects; focus risk.'] : [],
    opportunities: ['Focus on 1–3 highest-leverage projects for maximum progress.'],
    recommendedActions:
      blocked > 0 ? ['Unblock or park blocked projects.'] : [],
  };
}
