import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr } from '@/lib/result';
import { appError } from '@/lib/errors';

describe('result helpers', () => {
  const error = appError('not_found', 'Not found');

  it('ok() produces a success result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBe(42);
  });

  it('ok() works with objects', () => {
    const r = ok({ id: '1', name: 'test' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.name).toBe('test');
  });

  it('ok() works with null', () => {
    const r = ok(null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBeNull();
  });

  it('err() produces a failure result', () => {
    const r = err(error);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('not_found');
      expect(r.error.message).toBe('Not found');
    }
  });

  it('isOk() is true for ok results', () => {
    expect(isOk(ok('hello'))).toBe(true);
  });

  it('isOk() is false for err results', () => {
    expect(isOk(err(error))).toBe(false);
  });

  it('isErr() is true for err results', () => {
    expect(isErr(err(error))).toBe(true);
  });

  it('isErr() is false for ok results', () => {
    expect(isErr(ok('hello'))).toBe(false);
  });
});
