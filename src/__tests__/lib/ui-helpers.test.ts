/**
 * Tests for the client UI helpers added with the dashboard redesign:
 * cn() class joiner, usd() formatter, and the api-client envelope wrapper.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn } from '@/lib/cn';
import { api, usd } from '@/lib/api-client';

describe('cn', () => {
  it('joins truthy class names with spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values (false, null, undefined, empty)', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('returns an empty string when nothing is truthy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
});

describe('usd', () => {
  it('formats whole dollars with a currency symbol and no cents', () => {
    expect(usd(250)).toBe('$250');
    expect(usd(0)).toBe('$0');
  });

  it('adds thousands separators', () => {
    expect(usd(1250000)).toBe('$1,250,000');
  });

  it('formats negative amounts', () => {
    expect(usd(-80)).toBe('-$80');
  });
});

describe('api client envelope', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the parsed ok envelope on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, data: [{ id: '1' }] }),
    }) as unknown as typeof fetch;

    const res = await api.get<Array<{ id: string }>>('/api/things');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data[0]?.id).toBe('1');
  });

  it('passes through a server error envelope', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ok: false, error: { code: 'validation', message: 'bad' } }),
    }) as unknown as typeof fetch;

    const res = await api.post('/api/things', { a: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('validation');
  });

  it('returns a network error when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch;

    const res = await api.del('/api/things/1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toBe('Network error');
  });

  it('sets JSON content-type and method on writes', async () => {
    const spy = vi.fn().mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    globalThis.fetch = spy as unknown as typeof fetch;

    await api.patch('/api/things/1', { name: 'x' });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/things/1');
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
  });
});
