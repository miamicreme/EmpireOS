/**
 * Empire Score (0–100): a single number summarizing daily execution.
 *
 *   Cash progress:        30%
 *   High-priority actions: 25%
 *   Job hunt progress:    20%
 *   Follow-ups:           15%
 *   Daily review:         10%
 *
 * Each component is supplied as a 0..1 ratio; the service weights and grades.
 */
import { EMPIRE_SCORE_GRADES, EMPIRE_SCORE_WEIGHTS } from './constants';
import type { EmpireScoreResult } from './types';

export interface EmpireScoreComponents {
  /** cash collected today / daily target, clamped 0..1 */
  cashRatio: number;
  /** high-priority actions completed / surfaced, clamped 0..1 */
  actionsRatio: number;
  /** job hunt momentum (e.g. active applications progressing), 0..1 */
  jobHuntRatio: number;
  /** follow-ups done / due, 0..1 */
  followUpsRatio: number;
  /** daily review completed today: 0 or 1 */
  reviewRatio: number;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function gradeFor(score: number): EmpireScoreResult['grade'] {
  if (score >= EMPIRE_SCORE_GRADES.green) return 'green';
  if (score >= EMPIRE_SCORE_GRADES.yellow) return 'yellow';
  return 'red';
}

export function calculateEmpireScore(
  components: EmpireScoreComponents,
): EmpireScoreResult {
  const cash = clamp01(components.cashRatio) * EMPIRE_SCORE_WEIGHTS.cash * 100;
  const actions =
    clamp01(components.actionsRatio) * EMPIRE_SCORE_WEIGHTS.actions * 100;
  const jobHunt =
    clamp01(components.jobHuntRatio) * EMPIRE_SCORE_WEIGHTS.jobHunt * 100;
  const followUps =
    clamp01(components.followUpsRatio) * EMPIRE_SCORE_WEIGHTS.followUps * 100;
  const review =
    clamp01(components.reviewRatio) * EMPIRE_SCORE_WEIGHTS.review * 100;

  const score = Math.round(cash + actions + jobHunt + followUps + review);

  return {
    score,
    grade: gradeFor(score),
    breakdown: {
      cash: Number(cash.toFixed(1)),
      actions: Number(actions.toFixed(1)),
      jobHunt: Number(jobHunt.toFixed(1)),
      followUps: Number(followUps.toFixed(1)),
      review: Number(review.toFixed(1)),
    },
  };
}
