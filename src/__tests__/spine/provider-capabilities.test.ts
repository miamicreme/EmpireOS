import { describe, expect, it } from 'vitest';
import { getProviderCapabilities, routeProviderForTask } from '@/spine/ai/provider-capabilities';

describe('provider capabilities', () => {
  it('marks LM Studio as local/private text only when enabled with a model', () => {
    const env = {
      LMSTUDIO_ENABLED: 'true',
      LMSTUDIO_DEFAULT_MODEL: 'qwen2.5-7b-instruct',
    } as NodeJS.ProcessEnv;

    const lmstudio = getProviderCapabilities(env).find((provider) => provider.provider === 'lmstudio');
    expect(lmstudio?.configured).toBe(true);
    expect(lmstudio?.local).toBe(true);
    expect(lmstudio?.text).toBe(true);
    expect(lmstudio?.vision).toBe(false);
    expect(lmstudio?.deepReasoning).toBe(false);
  });

  it('routes local_private tasks only to LM Studio', () => {
    const env = {
      REQUESTY_API_KEY: 'rq-test',
      REQUESTY_DEFAULT_MODEL: 'rq/default',
      LMSTUDIO_ENABLED: 'true',
      LMSTUDIO_DEFAULT_MODEL: 'qwen2.5-7b-instruct',
    } as NodeJS.ProcessEnv;

    const route = routeProviderForTask('local_private', env);
    expect(route.ok).toBe(true);
    if (!route.ok) return;
    expect(route.provider).toBe('lmstudio');
  });

  it('fails closed when local_private is requested without LM Studio', () => {
    const route = routeProviderForTask('local_private', {
      REQUESTY_API_KEY: 'rq-test',
      REQUESTY_DEFAULT_MODEL: 'rq/default',
    } as NodeJS.ProcessEnv);
    expect(route).toEqual({ ok: false, code: 'local_provider_required' });
  });
});
