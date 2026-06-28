import { describe, it, expect } from 'vitest';
import {
  todayISODate,
  tomorrowISODate,
  isoDateDaysAgo,
  nowISO,
  weekStartISODate,
} from '@/lib/dates';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const FIXED = new Date('2024-03-15T12:00:00.000Z'); // Friday

describe('todayISODate', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(todayISODate(FIXED)).toMatch(ISO_DATE_RE);
  });

  it('returns the correct date for a fixed input', () => {
    expect(todayISODate(FIXED)).toBe('2024-03-15');
  });
});

describe('tomorrowISODate', () => {
  it('returns the next day', () => {
    expect(tomorrowISODate(FIXED)).toBe('2024-03-16');
  });

  it('rolls over month boundary', () => {
    const lastDay = new Date('2024-03-31T12:00:00.000Z');
    expect(tomorrowISODate(lastDay)).toBe('2024-04-01');
  });
});

describe('isoDateDaysAgo', () => {
  it('returns the date N days before now', () => {
    expect(isoDateDaysAgo(3, FIXED)).toBe('2024-03-12');
  });

  it('0 days ago is today', () => {
    expect(isoDateDaysAgo(0, FIXED)).toBe('2024-03-15');
  });

  it('1 day ago is yesterday', () => {
    expect(isoDateDaysAgo(1, FIXED)).toBe('2024-03-14');
  });

  it('crosses month boundary', () => {
    const march2 = new Date('2024-03-02T12:00:00.000Z');
    expect(isoDateDaysAgo(3, march2)).toBe('2024-02-28');
  });
});

describe('nowISO', () => {
  it('returns a valid ISO 8601 timestamp', () => {
    expect(nowISO(FIXED)).toMatch(ISO_TS_RE);
  });

  it('includes the correct date portion', () => {
    expect(nowISO(FIXED)).toContain('2024-03-15');
  });
});

describe('weekStartISODate', () => {
  it('returns Monday for a Friday input', () => {
    expect(weekStartISODate(FIXED)).toBe('2024-03-11');
  });

  it('returns the same Monday for a Monday input', () => {
    const monday = new Date('2024-03-11T12:00:00.000Z');
    expect(weekStartISODate(monday)).toBe('2024-03-11');
  });

  it('returns Monday for a Sunday input', () => {
    const sunday = new Date('2024-03-17T12:00:00.000Z');
    expect(weekStartISODate(sunday)).toBe('2024-03-11');
  });
});
