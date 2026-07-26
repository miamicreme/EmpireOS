import { describe, it, expect } from 'vitest';
import { callAssistRequestSchema } from '@/modules/call-command/schemas';
import { buildCallAssistPrompt } from '@/modules/call-command/prompts';
import { applyFallback } from '@/modules/call-command/service';
import { callAssistOutputSchema } from '@/spine/ai/ai.schemas';

describe('callAssistRequestSchema', () => {
  it('accepts a minimal valid request and defaults stage/history', () => {
    const r = callAssistRequestSchema.safeParse({ input: 'That sounds expensive.' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.stage).toBe('unknown');
      expect(r.data.history).toEqual([]);
      expect(r.data.recentLowConfidenceCount).toBe(0);
    }
  });

  it('rejects empty input', () => {
    const r = callAssistRequestSchema.safeParse({ input: '' });
    expect(r.success).toBe(false);
  });

  it('rejects oversized input', () => {
    const r = callAssistRequestSchema.safeParse({ input: 'a'.repeat(2001) });
    expect(r.success).toBe(false);
  });

  it('rejects more than 20 history turns', () => {
    const history = Array.from({ length: 21 }, () => ({ speaker: 'rep', text: 'hi' }));
    const r = callAssistRequestSchema.safeParse({ input: 'hello', history });
    expect(r.success).toBe(false);
  });

  it('rejects an invalid stage', () => {
    const r = callAssistRequestSchema.safeParse({ input: 'hello', stage: 'not-a-stage' });
    expect(r.success).toBe(false);
  });
});

describe('callAssistOutputSchema', () => {
  it('clamps out-of-range confidence and falls back to 0.5', () => {
    const r = callAssistOutputSchema.safeParse({ confidence: 5 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.confidence).toBe(0.5);
  });

  it('defaults missing fields', () => {
    const r = callAssistOutputSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.response).toBe('');
      expect(r.data.intent).toBe('unknown');
      expect(r.data.next_action).toBe('clarify');
    }
  });
});

describe('buildCallAssistPrompt', () => {
  const base = {
    input: 'That sounds expensive.',
    stage: 'unknown' as const,
    history: [],
    recentLowConfidenceCount: 0,
  };

  it('always includes the base constraints and strategy', () => {
    const { systemPrompt } = buildCallAssistPrompt(base);
    expect(systemPrompt).toContain('max 2 sentences');
    expect(systemPrompt).toContain('objection -> acknowledge + reframe + redirect');
  });

  it('injects "focus on value vs cost" only for price_objection intent', () => {
    const withIntent = buildCallAssistPrompt({ ...base, intent: 'price_objection' });
    expect(withIntent.injections).toContain('focus on value vs cost');
    expect(withIntent.systemPrompt).toContain('focus on value vs cost');

    const withoutIntent = buildCallAssistPrompt({ ...base, intent: 'interest' });
    expect(withoutIntent.injections).not.toContain('focus on value vs cost');
    expect(withoutIntent.systemPrompt).not.toContain('focus on value vs cost');
  });

  it('injects "drive toward commitment" only for the closing stage', () => {
    const closing = buildCallAssistPrompt({ ...base, stage: 'closing' });
    expect(closing.injections).toContain('drive toward commitment');

    const discovery = buildCallAssistPrompt({ ...base, stage: 'discovery' });
    expect(discovery.injections).not.toContain('drive toward commitment');
  });

  it('passes the live input as the redactable instruction, not baked into systemPrompt', () => {
    const { instruction, context, systemPrompt } = buildCallAssistPrompt(base);
    expect(instruction).toBe(base.input);
    expect(context).toMatchObject({ stage: 'unknown', history: [] });
    expect(systemPrompt).not.toContain(base.input);
  });
});

describe('applyFallback', () => {
  it('passes through a confident response unchanged and resets the streak', () => {
    const result = applyFallback(
      { response: 'Great, let’s move forward.', intent: 'interest', confidence: 0.9, next_action: 'advance' },
      1,
    );
    expect(result.response).toBe('Great, let’s move forward.');
    expect(result.next_action).toBe('advance');
    expect(result.escalate).toBe(false);
  });

  it('swaps in the safe fallback response below the confidence threshold', () => {
    const result = applyFallback(
      { response: 'model guess', intent: 'unknown', confidence: 0.2, next_action: 'advance' },
      0,
    );
    expect(result.next_action).toBe('clarify');
    expect(result.response).not.toBe('model guess');
  });

  it('does not escalate on the first low-confidence turn', () => {
    const result = applyFallback({ response: '', intent: 'unknown', confidence: 0.2, next_action: '' }, 0);
    expect(result.escalate).toBe(false);
  });

  it('escalates once the low-confidence streak reaches two', () => {
    const result = applyFallback({ response: '', intent: 'unknown', confidence: 0.2, next_action: '' }, 1);
    expect(result.escalate).toBe(true);
  });
});
