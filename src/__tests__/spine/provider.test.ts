import { describe, it, expect, vi, beforeEach } from 'vitest';

const envMock = vi.hoisted(() => {
  const aiKeys: Record<string, string | undefined> = {
    requesty: undefined,
    anthropic: undefined,
    openai: undefined,
    google: undefined,
    lmstudio: undefined,
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
  const lmStudioConfig: Record<string, string | boolean | null> = {
    enabled: false,
    apiKey: 'lm-studio',
    baseURL: 'http://localhost:1234/v1',
    defaultModel: null,
    fastModel: null,
  };
  return { aiKeys, requestyConfig, lmStudioConfig };
});

vi.mock('@/lib/env', () => ({
  aiKeys: envMock.aiKeys,
  requestyConfig: envMock.requestyConfig,
  lmStudioConfig: envMock.lmStudioConfig,
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
  hasLMStudioProvider: () =>
    Boolean(
      envMock.lmStudioConfig.enabled &&
        envMock.lmStudioConfig.baseURL &&
        envMock.lmStudioConfig.defaultModel,
    ),
}));

import { activeProvider, envProviderChain, isAllowedLMStudioBaseURL, modelForAdvisor } from '@/spine/ai/provider';
import { aiKeys, lmStudioConfig, requestyConfig } from '@/lib/env';

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
  (lmStudioConfig as Record<string, string | boolean | null>).enabled = false;
  (lmStudioConfig as Record<string, string | boolean | null>).baseURL = 'http://localhost:1234/v1';
  (lmStudioConfig as Record<string, string | boolean | null>).defaultModel = null;
  (lmStudioConfig as Record<string, string | boolean | null>).fastModel = null;
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

  it('places LM Studio after direct cloud providers and before free-tier fallbacks', () => {
    (aiKeys as Record<string, string | undefined>).google = 'goog-test';
    (aiKeys as Record<string, string | undefined>).lmstudio = 'lm-studio';
    (aiKeys as Record<string, string | undefined>).groq = 'gsk-test';
    (lmStudioConfig as Record<string, string | boolean | null>).enabled = true;
    (lmStudioConfig as Record<string, string | boolean | null>).defaultModel = 'qwen2.5-7b-instruct';
    expect(envProviderChain()).toEqual(['google', 'lmstudio', 'groq']);
    expect(activeProvider()).toBe('google');
  });

  it('uses LM Studio when enabled and no higher-priority provider exists', () => {
    (aiKeys as Record<string, string | undefined>).lmstudio = 'lm-studio';
    (lmStudioConfig as Record<string, string | boolean | null>).enabled = true;
    (lmStudioConfig as Record<string, string | boolean | null>).defaultModel = 'qwen2.5-7b-instruct';
    expect(activeProvider()).toBe('lmstudio');
    expect(envProviderChain()).toEqual(['lmstudio']);
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
    expect(modelForAdvisor('claude-haiku-4-5-20251001', 'anthropic')).toBe('claude-haiku-4-5-20251001');
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

  it('uses LM Studio model ids when LM Studio is the provider', () => {
    (lmStudioConfig as Record<string, string | boolean | null>).defaultModel = 'qwen2.5-7b-instruct';
    expect(modelForAdvisor(undefined, 'lmstudio')).toBe('qwen2.5-7b-instruct');
    expect(modelForAdvisor('local/fast', 'lmstudio')).toBe('local/fast');
  });
});

describe('LM Studio base URL guard', () => {
  it('allows localhost and private network hosts', () => {
    expect(isAllowedLMStudioBaseURL('http://localhost:1234/v1')).toBe(true);
    expect(isAllowedLMStudioBaseURL('http://127.0.0.1:1234/v1')).toBe(true);
    expect(isAllowedLMStudioBaseURL('http://192.168.1.50:1234/v1')).toBe(true);
    expect(isAllowedLMStudioBaseURL('http://10.0.0.5:1234/v1')).toBe(true);
    expect(isAllowedLMStudioBaseURL('http://100.64.0.10:1234/v1')).toBe(true);
  });

  it('rejects public or invalid LM Studio URLs', () => {
    expect(isAllowedLMStudioBaseURL('https://api.openai.com/v1')).toBe(false);
    expect(isAllowedLMStudioBaseURL('file:///tmp/model')).toBe(false);
    expect(isAllowedLMStudioBaseURL('not a url')).toBe(false);
  });
});
