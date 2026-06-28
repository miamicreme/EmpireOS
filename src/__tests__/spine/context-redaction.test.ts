import { describe, it, expect } from 'vitest';
import {
  redactSensitiveText,
  redactDecisionContext,
  assertNoHighRiskSecrets,
} from '@/spine/decisions/context-redaction.service';
import type { DecisionContext } from '@/spine/types';

const REDACTED = '[REDACTED]';

function makeCtx(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    moduleId: 'test',
    summary: 'Clean summary.',
    facts: {},
    risks: [],
    opportunities: [],
    recommendedActions: [],
    ...overrides,
  };
}

describe('redactSensitiveText', () => {
  it('redacts email addresses', () => {
    expect(redactSensitiveText('Contact me at john@example.com for details.')).toContain(REDACTED);
    expect(redactSensitiveText('Contact me at john@example.com for details.')).not.toContain('john@example.com');
  });

  it('redacts phone numbers', () => {
    expect(redactSensitiveText('Call 555-867-5309 anytime.')).toContain(REDACTED);
  });

  it('leaves clean text intact', () => {
    const text = 'Revenue grew 15% last quarter. No PII here.';
    expect(redactSensitiveText(text)).toBe(text);
  });

  it('redacts SSN pattern', () => {
    expect(redactSensitiveText('SSN is 123-45-6789.')).toContain(REDACTED);
    expect(redactSensitiveText('SSN is 123-45-6789.')).not.toContain('123-45-6789');
  });

  it('redacts EIN pattern', () => {
    expect(redactSensitiveText('EIN: 12-3456789')).toContain(REDACTED);
  });
});

describe('redactDecisionContext', () => {
  it('redacts email in summary', () => {
    const ctx = makeCtx({ summary: 'Contact ceo@acme.com for approval.' });
    expect(redactDecisionContext(ctx).summary).not.toContain('ceo@acme.com');
    expect(redactDecisionContext(ctx).summary).toContain(REDACTED);
  });

  it('redacts strings inside facts', () => {
    const ctx = makeCtx({ facts: { contact: 'reach out to jane@corp.io' } });
    const redacted = redactDecisionContext(ctx).facts as Record<string, string>;
    expect(redacted.contact).toContain(REDACTED);
  });

  it('redacts each string in risks array', () => {
    const ctx = makeCtx({ risks: ['Call 800-555-1234 for info', 'Market risk'] });
    const redacted = redactDecisionContext(ctx);
    expect(redacted.risks[0]).toContain(REDACTED);
    expect(redacted.risks[1]).toBe('Market risk');
  });

  it('redacts opportunities and recommendedActions', () => {
    const ctx = makeCtx({
      opportunities: ['Email partner@bizdev.com'],
      recommendedActions: ['Follow up with 212-555-0100'],
    });
    const redacted = redactDecisionContext(ctx);
    expect(redacted.opportunities[0]).toContain(REDACTED);
    expect(redacted.recommendedActions[0]).toContain(REDACTED);
  });

  it('preserves moduleId unchanged', () => {
    const ctx = makeCtx({ moduleId: 'cash-engine' } as Partial<DecisionContext>);
    expect(redactDecisionContext(ctx).moduleId).toBe('cash-engine');
  });

  it('does not mutate the original context', () => {
    const ctx = makeCtx({ summary: 'admin@test.com should review.' });
    const original = ctx.summary;
    redactDecisionContext(ctx);
    expect(ctx.summary).toBe(original);
  });
});

describe('assertNoHighRiskSecrets', () => {
  it('does not throw on clean text', () => {
    expect(() => assertNoHighRiskSecrets('Revenue was $1.2M this quarter.')).not.toThrow();
  });

  it('throws on SSN', () => {
    expect(() => assertNoHighRiskSecrets('SSN: 123-45-6789')).toThrow();
  });

  it('throws on EIN', () => {
    expect(() => assertNoHighRiskSecrets('EIN 12-3456789 on file')).toThrow();
  });

  it('throws on IBAN', () => {
    expect(() => assertNoHighRiskSecrets('IBAN: GB29NWBK60161331926819')).toThrow();
  });

  it('error has redaction_blocked code', () => {
    try {
      assertNoHighRiskSecrets('123-45-6789');
    } catch (e) {
      expect((e as { code: string }).code).toBe('redaction_blocked');
    }
  });
});
