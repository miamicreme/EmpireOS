import { describe, expect, it } from 'vitest';
import { emptyToday } from '@/lib/today/today-data';

describe('today command center data', () => {
  it('returns useful empty-state defaults', () => {
    const data = emptyToday();

    expect(data.highestValueMove).toBeNull();
    expect(data.topActions).toEqual([]);
    expect(data.derived.cashTargetToday).toBe(250);
    expect(data.derived.cashGapToday).toBe(250);
    expect(data.pendingDrafts).toEqual([]);
  });
});
