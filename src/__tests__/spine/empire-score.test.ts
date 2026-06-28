import { describe, it, expect } from 'vitest';
import { calculateEmpireScore } from '@/spine/empire-score.service';

const ALL_ZERO = {
  cashRatio: 0,
  actionsRatio: 0,
  jobHuntRatio: 0,
  followUpsRatio: 0,
  reviewRatio: 0,
};

const ALL_ONE = {
  cashRatio: 1,
  actionsRatio: 1,
  jobHuntRatio: 1,
  followUpsRatio: 1,
  reviewRatio: 1,
};

describe('calculateEmpireScore', () => {
  it('returns 0 when all components are zero', () => {
    expect(calculateEmpireScore(ALL_ZERO).score).toBe(0);
  });

  it('returns 100 when all components are 1', () => {
    expect(calculateEmpireScore(ALL_ONE).score).toBe(100);
  });

  it('cash contributes 30 points at ratio=1', () => {
    expect(calculateEmpireScore({ ...ALL_ZERO, cashRatio: 1 }).breakdown.cash).toBeCloseTo(30, 1);
  });

  it('actions contributes 25 points at ratio=1', () => {
    expect(calculateEmpireScore({ ...ALL_ZERO, actionsRatio: 1 }).breakdown.actions).toBeCloseTo(25, 1);
  });

  it('jobHunt contributes 20 points at ratio=1', () => {
    expect(calculateEmpireScore({ ...ALL_ZERO, jobHuntRatio: 1 }).breakdown.jobHunt).toBeCloseTo(20, 1);
  });

  it('followUps contributes 15 points at ratio=1', () => {
    expect(calculateEmpireScore({ ...ALL_ZERO, followUpsRatio: 1 }).breakdown.followUps).toBeCloseTo(15, 1);
  });

  it('review contributes 10 points at ratio=1', () => {
    expect(calculateEmpireScore({ ...ALL_ZERO, reviewRatio: 1 }).breakdown.review).toBeCloseTo(10, 1);
  });

  it('breakdown has all expected keys', () => {
    const { breakdown } = calculateEmpireScore(ALL_ONE);
    expect(breakdown).toHaveProperty('cash');
    expect(breakdown).toHaveProperty('actions');
    expect(breakdown).toHaveProperty('jobHunt');
    expect(breakdown).toHaveProperty('followUps');
    expect(breakdown).toHaveProperty('review');
  });

  it('grade is green for score >= 75', () => {
    expect(calculateEmpireScore(ALL_ONE).grade).toBe('green');
  });

  it('grade is yellow for 50 <= score < 75', () => {
    // cash(30) + actions(25) = 55
    const result = calculateEmpireScore({ ...ALL_ZERO, cashRatio: 1, actionsRatio: 1 });
    expect(result.score).toBe(55);
    expect(result.grade).toBe('yellow');
  });

  it('grade is red for score < 50', () => {
    // only review = 10
    expect(calculateEmpireScore({ ...ALL_ZERO, reviewRatio: 1 }).grade).toBe('red');
  });

  it('clamps ratios above 1 to 1', () => {
    expect(calculateEmpireScore({ ...ALL_ZERO, cashRatio: 99 }).breakdown.cash).toBeCloseTo(30, 1);
  });

  it('clamps negative ratios to 0', () => {
    expect(calculateEmpireScore({ ...ALL_ZERO, cashRatio: -5 }).breakdown.cash).toBe(0);
  });

  it('treats NaN ratio as 0', () => {
    expect(calculateEmpireScore({ ...ALL_ZERO, cashRatio: NaN }).breakdown.cash).toBe(0);
  });
});
