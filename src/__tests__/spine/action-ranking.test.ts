import { describe, it, expect } from 'vitest';
import {
  computeRankScore,
  recalculateActionRank,
  sortByRank,
} from '@/spine/action-ranking.service';
import type { GlobalAction } from '@/spine/types';

describe('computeRankScore', () => {
  it('computes base formula: impact + urgency + confidence - effort', () => {
    const score = computeRankScore({
      impact_score: 8,
      urgency_score: 7,
      effort_score: 3,
      confidence_score: 0.9,
    });
    expect(score).toBeCloseTo(12.9, 4);
  });

  it('applies empire_score_weight multiplier', () => {
    const score = computeRankScore({
      impact_score: 5,
      urgency_score: 5,
      effort_score: 0,
      confidence_score: 0,
      empire_score_weight: 2,
    });
    expect(score).toBe(20);
  });

  it('defaults weight to 1 when omitted', () => {
    const input = { impact_score: 4, urgency_score: 3, effort_score: 2, confidence_score: 0.5 };
    expect(computeRankScore(input)).toBe(
      computeRankScore({ ...input, empire_score_weight: 1 }),
    );
  });

  it('returns 0 for all-zero inputs', () => {
    expect(
      computeRankScore({ impact_score: 0, urgency_score: 0, effort_score: 0, confidence_score: 0 }),
    ).toBe(0);
  });

  it('handles max values', () => {
    const score = computeRankScore({
      impact_score: 10,
      urgency_score: 10,
      effort_score: 0,
      confidence_score: 1,
    });
    expect(score).toBeCloseTo(21, 4);
  });

  it('can produce negative score when effort dominates', () => {
    const score = computeRankScore({
      impact_score: 0,
      urgency_score: 0,
      effort_score: 10,
      confidence_score: 0,
    });
    expect(score).toBe(-10);
  });
});

describe('recalculateActionRank', () => {
  it('returns the input plus a rank_score property', () => {
    const input = { impact_score: 6, urgency_score: 5, effort_score: 2, confidence_score: 0.8 };
    const result = recalculateActionRank(input);
    expect(result).toMatchObject(input);
    expect(typeof result.rank_score).toBe('number');
  });

  it('rank_score matches computeRankScore', () => {
    const input = { impact_score: 7, urgency_score: 6, effort_score: 3, confidence_score: 0.7 };
    expect(recalculateActionRank(input).rank_score).toBe(computeRankScore(input));
  });

  it('does not mutate the original object', () => {
    const input = { impact_score: 5, urgency_score: 5, effort_score: 5, confidence_score: 0.5 };
    const before = { ...input };
    recalculateActionRank(input);
    expect(input).toEqual(before);
  });
});

describe('sortByRank', () => {
  const makeAction = (id: string, rank_score: number): GlobalAction =>
    ({ id, rank_score } as unknown as GlobalAction);

  it('sorts descending by rank_score', () => {
    const actions = [makeAction('a', 5), makeAction('b', 10), makeAction('c', 1)];
    expect(sortByRank(actions).map((a) => a.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the original array', () => {
    const actions = [makeAction('x', 3), makeAction('y', 8)];
    const copy = [...actions];
    sortByRank(actions);
    expect(actions).toEqual(copy);
  });

  it('treats null rank_score as 0', () => {
    const actions = [
      makeAction('high', 5),
      { id: 'null_rank', rank_score: null } as unknown as GlobalAction,
    ];
    const sorted = sortByRank(actions);
    expect(sorted[0]?.id).toBe('high');
  });
});
