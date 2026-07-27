/**
 * runStructured provider/model attribution.
 *
 * callAI resolves its own internal env-provider failover when no credential is
 * pinned, so the provider/model that actually served a request can differ from
 * the pre-call guess (`activeProvider()`). runStructured must report what
 * actually ran, not the guess — regression test for that attribution bug.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/spine/ai/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/spine/ai/provider')>();
  return {
    ...actual,
    // Simulate: the guessed first-choice provider is anthropic, but callAI's
    // internal failover actually landed on openai.
    activeProvider: () => 'anthropic',
    callAI: vi.fn().mockResolvedValue({
      text: '{"value":"ok"}',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 10,
      outputTokens: 5,
    }),
  };
});

describe('runStructured provider/model attribution', () => {
  it('reports the provider/model callAI actually used, not the pre-call guess', async () => {
    const { runStructured } = await import('@/spine/ai/ai-runner');
    const result = await runStructured({
      feature: 'test_attribution',
      systemPrompt: 'x',
      instruction: 'plan',
      context: { note: 'clean' },
      schema: z.object({ value: z.string() }),
      stub: { value: 'STUB' },
    });

    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.data).toEqual({ value: 'ok' });
  });
});
