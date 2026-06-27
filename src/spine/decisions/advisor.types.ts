/**
 * Advisor types for the multi-advisor AI decision layer.
 *
 * For V3 these describe the shape of advisor inputs/outputs. Real LLM providers
 * are wired later (feature/decision-engine-v3); see decision-orchestrator.service.ts.
 */
import type { AdvisorRole, DecisionContext } from '../types';

export interface AdvisorDefinition {
  role: AdvisorRole;
  name: string;
  /** Short description of the lens this advisor brings. */
  lens: string;
  /** Provider/model to use when keys are present (e.g. 'claude-opus-4-8'). */
  preferredModel?: string;
}

export interface AdvisorInput {
  role: AdvisorRole;
  context: DecisionContext;
  question: string;
}

export interface AdvisorOutput {
  role: AdvisorRole;
  advisorName: string;
  modelName: string | null;
  recommendation: string;
  reasoning: string;
  confidence: number; // 0..1
  risks: string;
  nextActions: string[];
  redactionsApplied: boolean;
}

export interface FinalRecommendation {
  recommendation: string;
  confidence: number; // 0..1
  riskLevel: string;
  upsideLevel: string;
  rationale: string;
  selectedOption?: string;
}

/** The six standard advisors of the Empire OS decision panel. */
export const ADVISOR_PANEL: ReadonlyArray<AdvisorDefinition> = [
  {
    role: 'cash_advisor',
    name: 'Cash Advisor',
    lens: 'near-term cash generation',
    preferredModel: 'claude-haiku-4-5-20251001',
  },
  {
    role: 'career_advisor',
    name: 'Career Advisor',
    lens: 'high-income role progression',
    preferredModel: 'claude-haiku-4-5-20251001',
  },
  {
    role: 'risk_advisor',
    name: 'Risk Advisor',
    lens: 'downside, exposure, failure modes',
    preferredModel: 'claude-haiku-4-5-20251001',
  },
  {
    role: 'deal_advisor',
    name: 'Deal Advisor',
    lens: 'acquisition and deal structure',
    preferredModel: 'claude-haiku-4-5-20251001',
  },
  {
    role: 'execution_advisor',
    name: 'Execution Advisor',
    lens: 'sequencing and next steps',
    preferredModel: 'claude-haiku-4-5-20251001',
  },
  {
    role: 'final_judge',
    name: 'Final Judge',
    lens: 'synthesis into a recommendation',
    preferredModel: 'claude-sonnet-4-6',
  },
];
