import { describe, it, expect } from 'vitest';
import { appError, httpStatusForError } from '@/lib/errors';

describe('appError', () => {
  it('creates an error with code and message', () => {
    const e = appError('not_found', 'Resource missing');
    expect(e.code).toBe('not_found');
    expect(e.message).toBe('Resource missing');
    expect(e.details).toBeUndefined();
  });

  it('includes optional details', () => {
    const e = appError('validation', 'Bad input', { field: 'name' });
    expect(e.details).toEqual({ field: 'name' });
  });
});

describe('httpStatusForError', () => {
  const cases: Array<[Parameters<typeof httpStatusForError>[0], number]> = [
    ['unauthorized', 401],
    ['forbidden', 403],
    ['redaction_blocked', 403],
    ['not_found', 404],
    ['conflict', 409],
    ['invalid_state', 409],
    ['validation', 422],
    ['db_error', 500],
    ['ai_provider_error', 500],
    ['internal', 500],
  ];

  it.each(cases)('%s → %d', (code, expected) => {
    expect(httpStatusForError(code)).toBe(expected);
  });
});
