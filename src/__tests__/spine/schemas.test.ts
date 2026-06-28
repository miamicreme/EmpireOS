import { describe, it, expect } from 'vitest';
import {
  createGlobalActionSchema,
  createDecisionSchema,
  updateDecisionSchema,
  createModuleMetricSchema,
  createCashEntrySchema,
  createJobApplicationSchema,
} from '@/spine/schemas';

function pass<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, input: unknown) {
  const result = schema.safeParse(input);
  expect(result.success).toBe(true);
  return result.data as T;
}

function fail(schema: { safeParse: (v: unknown) => { success: boolean } }, input: unknown) {
  expect(schema.safeParse(input).success).toBe(false);
}

// ---------------------------------------------------------------------------
// createGlobalActionSchema
// ---------------------------------------------------------------------------
describe('createGlobalActionSchema', () => {
  const base = { title: 'Close the deal' };

  it('accepts a valid minimal input', () => {
    pass(createGlobalActionSchema, base);
  });

  it('rejects missing title', () => {
    fail(createGlobalActionSchema, {});
  });

  it('rejects empty title', () => {
    fail(createGlobalActionSchema, { title: '' });
  });

  it('rejects archived status', () => {
    fail(createGlobalActionSchema, { title: 'Test', status: 'archived' });
  });

  it('rejects empire_score_weight above 5', () => {
    fail(createGlobalActionSchema, { title: 'Test', empire_score_weight: 6 });
  });

  it('accepts empire_score_weight at boundary (5)', () => {
    pass(createGlobalActionSchema, { title: 'Test', empire_score_weight: 5 });
  });

  it('rejects invalid status', () => {
    fail(createGlobalActionSchema, { title: 'Test', status: 'invalid_status' });
  });
});

// ---------------------------------------------------------------------------
// createDecisionSchema
// ---------------------------------------------------------------------------
describe('createDecisionSchema', () => {
  const base = { title: 'Buy the building', question: 'Should we acquire it?' };

  it('accepts a valid input', () => {
    pass(createDecisionSchema, base);
  });

  it('defaults status to draft', () => {
    const result = pass(createDecisionSchema, base) as { status: string };
    expect(result.status).toBe('draft');
  });

  it('rejects status other than draft', () => {
    fail(createDecisionSchema, { ...base, status: 'analyzing' });
    fail(createDecisionSchema, { ...base, status: 'decided' });
    fail(createDecisionSchema, { ...base, status: 'archived' });
  });

  it('rejects missing question', () => {
    fail(createDecisionSchema, { title: 'Title only' });
  });
});

// ---------------------------------------------------------------------------
// updateDecisionSchema
// ---------------------------------------------------------------------------
describe('updateDecisionSchema', () => {
  it('accepts archived status', () => {
    pass(updateDecisionSchema, { status: 'archived' });
  });

  it('rejects draft status', () => {
    fail(updateDecisionSchema, { status: 'draft' });
  });

  it('rejects decided status', () => {
    fail(updateDecisionSchema, { status: 'decided' });
  });

  it('rejects analyzing status', () => {
    fail(updateDecisionSchema, { status: 'analyzing' });
  });

  it('accepts empty object (all fields optional)', () => {
    pass(updateDecisionSchema, {});
  });

  it('accepts title-only update', () => {
    pass(updateDecisionSchema, { title: 'Updated title' });
  });
});

// ---------------------------------------------------------------------------
// createModuleMetricSchema
// ---------------------------------------------------------------------------
describe('createModuleMetricSchema', () => {
  const base = { metric_key: 'cash_today', metric_label: 'Cash Today' };

  it('accepts valid minimal input', () => {
    pass(createModuleMetricSchema, base);
  });

  it('metric_value is optional', () => {
    pass(createModuleMetricSchema, base);
  });

  it('rejects empty metric_key', () => {
    fail(createModuleMetricSchema, { ...base, metric_key: '' });
  });
});

// ---------------------------------------------------------------------------
// createCashEntrySchema
// ---------------------------------------------------------------------------
describe('createCashEntrySchema', () => {
  const base = { source: 'Delivery', gross_amount: 150 };

  it('accepts valid input', () => {
    pass(createCashEntrySchema, base);
  });

  it('rejects negative gross_amount', () => {
    fail(createCashEntrySchema, { source: 'Delivery', gross_amount: -1 });
  });

  it('accepts zero gross_amount', () => {
    pass(createCashEntrySchema, { source: 'Delivery', gross_amount: 0 });
  });

  it('rejects missing source', () => {
    fail(createCashEntrySchema, { gross_amount: 100 });
  });
});

// ---------------------------------------------------------------------------
// createJobApplicationSchema
// ---------------------------------------------------------------------------
describe('createJobApplicationSchema', () => {
  const base = { company: 'Acme Corp', role: 'Senior Engineer' };

  it('accepts valid minimal input', () => {
    pass(createJobApplicationSchema, base);
  });

  it('rejects invalid email', () => {
    fail(createJobApplicationSchema, { ...base, recruiter_email: 'not-an-email' });
  });

  it('accepts valid email', () => {
    pass(createJobApplicationSchema, { ...base, recruiter_email: 'recruiter@acme.com' });
  });

  it('accepts null email', () => {
    pass(createJobApplicationSchema, { ...base, recruiter_email: null });
  });

  it('rejects invalid URL', () => {
    fail(createJobApplicationSchema, { ...base, job_url: 'not-a-url' });
  });

  it('accepts valid URL', () => {
    pass(createJobApplicationSchema, { ...base, job_url: 'https://jobs.acme.com/123' });
  });

  it('accepts null URL', () => {
    pass(createJobApplicationSchema, { ...base, job_url: null });
  });
});
