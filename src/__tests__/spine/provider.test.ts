import { describe, it, expect, vi, beforeEach } from 'vitest';

const envMock = vi.hoisted(() => {
  const aiKeys: Record<string, string | undefined> = {
    requesty: undefined,
    anthropic: undefined,
    openai: undefined,
    google: undefined,
    groq: undefined,
    cerebras: undefined,
    openrouter: undefined,
    mistral: undefined,
  };
  const requestyConfig: Record<string, string | null> = {
    apiKey: null,
    baseURL: 'https://router.requesty.ai/v1',
    defaultModel: null,
    fastModel: null,
    standardModel: null,
    deepModel: null,
    visionModel: null,
  };
  return { aiKeys, requestyConfig };
});

// Stub env module before importing provider so aiKeys reflects test state.
vi.mock('@/lib/env', () => ({
  aiKeys: envMock.aiKeys,
  requestyConfig: envMock.requestyConfig,
  hasRequestyProvider: () =>
    Boolean(
      envMock.requestyConfig.apiKey &&
        envMock.requestyConfig.baseURL &&
        (envMock.requestyConfig.defaultModel ||
          envMock.requestyConfig.fastModel ||
          envMock.requestyConfig.standardModel ||
          envMock.requestyConfig.deepModel ||
          envMock.requestyConfig.visionModel),
    ),
}));

import { activeProvider, envProviderChain, modelForAdvisor } from '@/spine/ai/provider';
import { aiKeys, requestyConfig } from '@/lib/env';

beforeEach(() => {
  for (const key of Object.keys(aiKeys)) {
    (aiKeys as Record<string, string | undefined>)[key] = undefined;
  }
  (requestyConfig as Record<string, string | null>).apiKey = null;
  (requestyConfig as Record<string, string | null>).baseURL = 'https://router.requesty.ai/v1';
  (requestyConfig as Record<string, string | null>).defaultModel = null;
  (requestyConfig as Record<string, string | null>).fastModel = null;
  (requestyConfig as Record<string, string | null>).standardModel = null;
  (requestyConfig as Record<string, string | null>).deepModel = null;
  (requestyConfig as Record<string, string | null>).visionModel = null;
});

describe('activeProvider', () => {
  it('returns stub when no keys are set', () => {
    expect(activeProvider()).toBe('stub');
  });

  it('prefers requesty when the router is configured', () => {
    (aiKeys as Record<string, string | undefined>).requesty = 'rq-test';
    (requestyConfig as Record<string, string | null>).apiKey = 'rq-test';
    (requestyConfig as Record<string, string | null>).fastModel = 'google/gemini-flash';
    (aiKeys as Record<string, string | undefined>).anthropic = 'sk-ant-test';
    expect(activeProvider()).toBe('requesty');
    expect(envProviderChain()).toEqual(['requesty', 'anthropic']);
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

  it('keeps direct provider keys as the chain when requesty is missing', () => {
    (aiKeys as Record<string, string | undefined>).openai = 'sk-openai-test';
    (aiKeys as Record<string, string | undefined>).google = 'goog-test';
    expect(envProviderChain()).toEqual(['openai', 'google']);
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

  it('uses requesty route model ids when requesty is the provider', () => {
    (requestyConfig as Record<string, string | null>).defaultModel = 'requesty/default';
    expect(modelForAdvisor(undefined, 'requesty')).toBe('requesty/default');
    expect(modelForAdvisor('requesty/fast', 'requesty')).toBe('requesty/fast');
  });
});
