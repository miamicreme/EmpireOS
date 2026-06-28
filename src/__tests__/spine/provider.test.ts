import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub env module before importing provider so aiKeys reflects test state.
vi.mock('@/lib/env', () => ({
  aiKeys: { anthropic: undefined, openai: undefined, google: undefined },
}));

import { activeProvider, modelForAdvisor } from '@/spine/ai/provider';
import { aiKeys } from '@/lib/env';

beforeEach(() => {
  // Reset all keys to undefined before each test
  (aiKeys as Record<string, string | undefined>).anthropic = undefined;
  (aiKeys as Record<string, string | undefined>).openai = undefined;
  (aiKeys as Record<string, string | undefined>).google = undefined;
});

describe('activeProvider', () => {
  it('returns stub when no keys are set', () => {
    expect(activeProvider()).toBe('stub');
  });

  it('returns anthropic when anthropic key is set', () => {
    (aiKeys as Record<string, string | undefined>).anthropic = 'sk-ant-test';
    expect(activeProvider()).toBe('anthropic');
  });

  it('returns openai when only openai key is set', () => {
    (aiKeys as Record<string, string | undefined>).openai = 'sk-openai-test';
    expect(activeProvider()).toBe('openai');
  });

  it('returns google when only google key is set', () => {
    (aiKeys as Record<string, string | undefined>).google = 'goog-test';
    expect(activeProvider()).toBe('google');
  });

  it('prefers anthropic over openai when both are set', () => {
    (aiKeys as Record<string, string | undefined>).anthropic = 'sk-ant-test';
    (aiKeys as Record<string, string | undefined>).openai = 'sk-openai-test';
    expect(activeProvider()).toBe('anthropic');
  });
});

describe('modelForAdvisor', () => {
  it('returns the preferred model when provider is anthropic', () => {
    expect(modelForAdvisor('claude-haiku-4-5-20251001', 'anthropic')).toBe(
      'claude-haiku-4-5-20251001',
    );
  });

  it('ignores preferred model for openai, returns gpt-4o-mini', () => {
    expect(modelForAdvisor('claude-haiku-4-5-20251001', 'openai')).toBe('gpt-4o-mini');
  });

  it('ignores preferred model for google, returns gemini-2.5-flash', () => {
    expect(modelForAdvisor('claude-haiku-4-5-20251001', 'google')).toBe('gemini-2.5-flash');
  });

  it('falls back to claude-sonnet-4-6 when preferred is undefined and provider is anthropic', () => {
    expect(modelForAdvisor(undefined, 'anthropic')).toBe('claude-sonnet-4-6');
  });

  it('returns stub for stub provider', () => {
    expect(modelForAdvisor(undefined, 'stub')).toBe('stub');
  });
});
