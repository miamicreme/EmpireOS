import { describe, expect, it } from 'vitest';
import { buildBrief, classifyAsset, detectMissingInformation, extractFactCandidates } from '@/modules/deal-intel/engine';
import type { CanonicalFact } from '@/modules/deal-intel/types';

const fact = (key: string, value: unknown): CanonicalFact => ({ id: key, deal_id: 'deal-1', fact_key: key, fact_value_json: value, fact_type: typeof value, confidence_score: 0.7, verification_status: 'broker_provided', created_by: 'test', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

describe('Deal Intelligence Engine', () => {
  it('classifies and extracts canonical facts from raw business listing text', () => {
    const raw = 'Miami laundromat business. Asking price $1.2M. Revenue $650,000. SDE $310k. Seller financing available.';
    expect(classifyAsset(raw)).toBe('business');
    const facts = extractFactCandidates(raw);
    expect(facts.map((f) => f.key)).toEqual(expect.arrayContaining(['asking_price', 'revenue', 'sde', 'seller_financing_available']));
    expect(facts.find((f) => f.key === 'asking_price')?.value).toBe(1_200_000);
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
});
