/**
 * Action ranking. The Spine owns priority, so rank is computed here (service
 * layer), never trusted from the client.
 *
 *   rank_score = impact + urgency + confidence - effort
 *
 * confidence_score is 0..1; impact/urgency/effort are 0..10.
 */
import type { GlobalAction } from './types';

export interface RankInputs {
  impact_score: number;
  urgency_score: number;
  effort_score: number;
  confidence_score: number;
  empire_score_weight?: number;
}

export function computeRankScore(input: RankInputs): number {
  const base =
    input.impact_score +
    input.urgency_score +
    input.confidence_score -
    input.effort_score;
  const weight = input.empire_score_weight ?? 1;
  return Number((base * weight).toFixed(4));
}

/** Returns a copy of the action with a freshly computed rank_score. */
export function recalculateActionRank<T extends RankInputs>(
  action: T,
): T & { rank_score: number } {
  return { ...action, rank_score: computeRankScore(action) };
}

/** Sorts a list of actions by rank descending (highest priority first). */
export function sortByRank(actions: GlobalAction[]): GlobalAction[] {
  return [...actions].sort((a, b) => (b.rank_score ?? 0) - (a.rank_score ?? 0));
}
