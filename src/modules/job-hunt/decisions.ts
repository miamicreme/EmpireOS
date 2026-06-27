import type { SupabaseClient } from '@supabase/supabase-js';
import type { DecisionContext, JobApplication } from '@/spine/types';
import { manifest } from './manifest';

export async function getDecisionContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecisionContext> {
  const { data } = await supabase
    .from('job_applications')
    .select('status, company, role')
    .eq('user_id', userId);
  const apps = (data ?? []) as Pick<JobApplication, 'status' | 'company' | 'role'>[];
  const interviewing = apps.filter((a) => a.status === 'interviewing').length;

  return {
    moduleId: manifest.id,
    summary: `${apps.length} applications, ${interviewing} interviewing.`,
    facts: { total: apps.length, interviewing },
    risks: apps.length === 0 ? ['No job pipeline.'] : [],
    opportunities: ['Prioritize highest-salary roles with active recruiters.'],
    recommendedActions: apps.length === 0 ? ['Add 3 high-income target roles.'] : [],
  };
}
