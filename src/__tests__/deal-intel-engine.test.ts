import { describe, expect, it } from 'vitest';
import { buildBrief, classifyAsset, detectMissingInformation, extractFactCandidates } from '@/modules/deal-intel/engine';
import { canonicalFactInputSchema } from '@/modules/deal-intel/schemas';
import type { CanonicalFact } from '@/modules/deal-intel/types';

const fact = (key: string, value: unknown): CanonicalFact => ({
  id: key,
  deal_id: 'deal-1',
  fact_key: key,
  fact_value_json: value,
  fact_type: typeof value,
  confidence_score: 0.7,
  verification_status: 'broker_provided',
  created_by: 'test',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe('Deal Intelligence Engine', () => {
  it('classifies and extracts canonical facts from raw business listing text', () => {
    const raw = 'Miami laundromat business. Asking price $1.2M. Revenue $650,000. SDE $310k. Seller financing available.';

    expect(classifyAsset(raw)).toBe('business');
    const facts = extractFactCandidates(raw);

    expect(facts.map((candidate) => candidate.key)).toEqual(
      expect.arrayContaining(['asking_price', 'revenue', 'sde', 'seller_financing_available']),
    );
    expect(facts.find((candidate) => candidate.key === 'asking_price')?.value).toBe(1_200_000);
  });

  it('recognizes non-real-estate asset classes instead of forcing everything into property', () => {
    expect(classifyAsset('B2B SaaS website with $42k MRR')).toBe('digital_business');
    expect(classifyAsset('Seller note secured by laundromat equipment')).toBe('debt_note');
    expect(classifyAsset('FedEx delivery route with trucks included')).toBe('route_business');
    expect(classifyAsset('Machine shop equipment package with CNC fleet')).toBe('equipment');
  });

  it('detects missing diligence and returns a visual Deal Intelligence Brief', () => {
    const facts = [fact('asking_price', 1_200_000), fact('sde', 310_000), fact('seller_financing_available', true)];
    const missing = detectMissingInformation(facts, 'Asking price $1.2M. SDE $310k. Seller financing available.');
    const brief = buildBrief('deal-1', 'Miami Laundromat', facts, missing);

    expect(missing).toContain('tax_returns');
    expect(brief.probability_of_success).toBeGreaterThan(0.5);
    expect(brief.visual_payload).toHaveProperty('score_gauge');
    expect(brief.visual_payload).toHaveProperty('risk_matrix');
    expect(brief.next_actions[0]).toContain('Request');
  });

  it('validates Data Steward canonical fact updates with confidence and verification status', () => {
    const parsed = canonicalFactInputSchema.parse({
      fact_key: 'asking_price',
      fact_value_json: 950000,
      fact_type: 'currency',
      unit: 'USD',
      confidence_score: 0.95,
      verification_status: 'document_verified',
      created_by: 'data_steward',
    });

    expect(parsed.verification_status).toBe('document_verified');
    expect(parsed.confidence_score).toBe(0.95);
  });
});
