import type { SupabaseClient } from '@supabase/supabase-js';
import type { DecisionContext, JobApplication } from '@/spine/types';
import { manifest } from './manifest';
import { getPipelineIntelligence } from './intelligence';

export async function getDecisionContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecisionContext> {
  const { data } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId);

  const apps = (data ?? []) as JobApplication[];
  const intelligence = getPipelineIntelligence(apps);
  const top = intelligence.topOpportunity;

  return {
    moduleId: manifest.id,
    summary: top
      ? `${apps.length} applications, ${intelligence.interviewing} interviewing. Top opportunity: ${top.role} at ${top.company} (${top.verdict}, ${top.score}/100).`
      : `${apps.length} applications, ${intelligence.interviewing} interviewing. No scored top opportunity yet.`,
    facts: {
      total: apps.length,
      active: intelligence.active,
      interviewing: intelligence.interviewing,
      offers: intelligence.offers,
      strongFitCount: intelligence.strongFitCount,
      missingNextActions: intelligence.missingNextActions,
      missingSalary: intelligence.missingSalary,
      topOpportunity: top
        ? {
            company: top.company,
            role: top.role,
            score: top.score,
            verdict: top.verdict,
            stage: top.stage,
            nextBestMove: top.nextBestMove,
          }
        : null,
    },
    risks: intelligence.risks,
    opportunities: [
      ...(top ? [`Highest-leverage role now: ${top.role} at ${top.company}.`] : []),
      'Use drafter-reviewer workflow: evaluate fit, tailor resume, write cover letter, then run critique before sending.',
      'For interviews, prepare STAR stories, honest gap bridges, and 4-6 questions to ask.',
      ...intelligence.recommendations,
    ],
    recommendedActions: top
      ? [top.nextBestMove, ...intelligence.recommendations.slice(0, 3)]
      : intelligence.recommendations,
  };
}
