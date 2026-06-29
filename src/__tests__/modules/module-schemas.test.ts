/**
 * Regression tests for module-local create schemas: optional fields must accept
 * `null` (not just `undefined`), because the client forms send `null` for blank
 * inputs and the DB columns are nullable. Guards against the Codex P1 finding
 * where blank optional fields produced validation errors before insert.
 */
import { describe, it, expect } from 'vitest';
import { createProjectSchema } from '@/modules/projects/schemas';
import { createCreditItemSchema } from '@/modules/credit-funding/schemas';
import { createAcquisitionTargetSchema } from '@/modules/acquisitions/schemas';

describe('createProjectSchema', () => {
  it('accepts null for all optional fields with only name provided', () => {
    const r = createProjectSchema.safeParse({
      name: 'Launch',
      revenue_potential: null,
      next_action: null,
      blocker: null,
      notes: null,
    });
    expect(r.success).toBe(true);
  });
});

describe('createCreditItemSchema', () => {
  it('accepts null for all optional fields with only item_name provided', () => {
    const r = createCreditItemSchema.safeParse({
      item_name: 'Collection X',
      bureau: null,
      item_type: null,
      due_at: null,
      next_action: null,
      notes: null,
    });
    expect(r.success).toBe(true);
  });
});

describe('createAcquisitionTargetSchema', () => {
  it('accepts null for all optional fields with required fields provided', () => {
    const r = createAcquisitionTargetSchema.safeParse({
      name: 'Laundromat',
      target_type: 'business',
      location: null,
      asking_price: null,
      revenue: null,
      noi: null,
      next_action: null,
      notes: null,
    });
    expect(r.success).toBe(true);
  });
});
