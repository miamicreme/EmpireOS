import { describe, it, expect } from 'vitest';
import {
  buildAdvisorPrompt,
  parseAdvisorResponse,
} from '@/spine/ai/advisor-prompts';
import type { AdvisorRole } from '@/spine/types';
import type { DecisionContext } from '@/spine/types';

const CTX: DecisionContext = {
  moduleId: 'test',
  summary: 'Evaluating a small business acquisition.',
  facts: { asking_price: 250000, revenue: 80000 },
  risks: ['Seller may inflate revenue'],
  opportunities: ['Seller financing possible'],
  recommendedActions: ['Get a broker opinion of value'],
};

const ALL_ROLES: AdvisorRole[] = [
  'cash_advisor',
  'career_advisor',
  'risk_advisor',
  'deal_advisor',
  'execution_advisor',
  'final_judge',
];

describe('buildAdvisorPrompt', () => {
  it('returns systemPrompt and userPrompt strings', () => {
    const result = buildAdvisorPrompt('cash_advisor', 'Should I buy this business?', CTX);
    expect(typeof result.systemPrompt).toBe('string');
    expect(typeof result.userPrompt).toBe('string');
  });

  it('places the question in userPrompt', () => {
    const result = buildAdvisorPrompt('risk_advisor', 'Is this a good deal?', CTX);
    expect(result.userPrompt).toContain('Is this a good deal?');
  });

  it('each role produces a distinct systemPrompt', () => {
    const prompts = ALL_ROLES.map((role) =>
      buildAdvisorPrompt(role, 'Question?', CTX).systemPrompt,
    );
    const unique = new Set(prompts);
    expect(unique.size).toBe(ALL_ROLES.length);
  });

  it('redacts email in question before including in userPrompt', () => {
    const result = buildAdvisorPrompt(
      'cash_advisor',
      'Contact seller@business.com to negotiate.',
      CTX,
    );
    expect(result.userPrompt).not.toContain('seller@business.com');
    expect(result.userPrompt).toContain('[REDACTED]');
  });

  it('does NOT include priorVotes section for non-judge roles', () => {
    const votes = [{ role: 'cash_advisor', recommendation: 'Buy it.', confidence: 0.8 }];
    const result = buildAdvisorPrompt('risk_advisor', 'Question?', CTX, votes);
    expect(result.userPrompt).not.toContain('ADVISOR PANEL VOTES');
  });

  it('includes priorVotes section only for final_judge', () => {
    const votes = [
      { role: 'cash_advisor', recommendation: 'Buy it.', confidence: 0.8 },
      { role: 'risk_advisor', recommendation: 'Risky.', confidence: 0.6 },
    ];
    const result = buildAdvisorPrompt('final_judge', 'Question?', CTX, votes);
    expect(result.userPrompt).toContain('ADVISOR PANEL VOTES');
    expect(result.userPrompt).toContain('cash_advisor');
    expect(result.userPrompt).toContain('risk_advisor');
  });

  it('omits priorVotes section when array is empty', () => {
    const result = buildAdvisorPrompt('final_judge', 'Question?', CTX, []);
    expect(result.userPrompt).not.toContain('ADVISOR PANEL VOTES');
  });
});

describe('parseAdvisorResponse', () => {
  const validJson = JSON.stringify({
    recommendation: 'Proceed with caution.',
    reasoning: 'Revenue is plausible but unverified.',
    confidence: 0.75,
    risks: 'Seller may be motivated by distress.',
    next_actions: ['Verify financials', 'Get LOI'],
  });

  it('parses valid JSON response', () => {
    const result = parseAdvisorResponse(validJson);
    expect(result.recommendation).toBe('Proceed with caution.');
    expect(result.confidence).toBe(0.75);
    expect(result.next_actions).toEqual(['Verify financials', 'Get LOI']);
  });

  it('strips markdown code fences', () => {
    const fenced = '```json\n' + validJson + '\n```';
    const result = parseAdvisorResponse(fenced);
    expect(result.recommendation).toBe('Proceed with caution.');
  });

  it('strips bare code fences', () => {
    const fenced = '```\n' + validJson + '\n```';
    const result = parseAdvisorResponse(fenced);
    expect(result.confidence).toBe(0.75);
  });

  it('falls back to 0.5 for non-numeric confidence', () => {
    const json = JSON.stringify({ ...JSON.parse(validJson), confidence: 'high' });
    const result = parseAdvisorResponse(json);
    expect(result.confidence).toBe(0.5);
  });

  it('clamps confidence above 1 to 1', () => {
    const json = JSON.stringify({ ...JSON.parse(validJson), confidence: 1.5 });
    expect(parseAdvisorResponse(json).confidence).toBe(1);
  });

  it('clamps confidence below 0 to 0', () => {
    const json = JSON.stringify({ ...JSON.parse(validJson), confidence: -0.3 });
    expect(parseAdvisorResponse(json).confidence).toBe(0);
  });

  it('handles invalid JSON gracefully with prose fallback', () => {
    const result = parseAdvisorResponse('This is a prose response from the model.');
    expect(result.recommendation).toContain('This is a prose response');
    expect(result.confidence).toBe(0.4);
    expect(result.next_actions).toEqual([]);
  });

  it('provides defaults for missing fields', () => {
    const result = parseAdvisorResponse('{}');
    expect(result.recommendation).toBe('No recommendation provided.');
    expect(result.next_actions).toEqual([]);
  });
});
