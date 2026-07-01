/**
 * Provider router.
 *
 * Picks the runtime strategy (model + specialists + budgets) from intent and
 * path, and resolves the credential. It does NOT duplicate provider logic — the
 * actual calls go through the V2 `callAI`/`runStructured` abstraction; every
 * call is logged to agent_provider_runs by the orchestrator.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { aiConfig } from '@/lib/env';
import { resolveUserCredentials } from '../providers/provider-config.service';
import { activeProvider, type AICredential } from '../provider';
import type {
  AgentIntent,
  ProviderStrategy,
  RiskLevel,
  RuntimePath,
} from './agent.types';

/** Specialist trigger matrix — only consulted on the deep path. */
const SPECIALISTS_BY_INTENT: Record<AgentIntent, string[]> = {
  daily_planning: ['execution_operator'],
  cash: ['finance_expert', 'execution_operator'],
  job_hunt: ['career_income_strategist', 'execution_operator'],
  followup: ['execution_operator', 'risk_compliance_critic'],
  credit_funding: ['business_credit_expert', 'finance_expert', 'risk_compliance_critic'],
  projects: ['execution_operator', 'business_strategist'],
  acquisitions: ['deal_acquisition_analyst', 'finance_expert', 'risk_compliance_critic'],
  stock_trading: ['market_trading_analyst', 'finance_expert', 'risk_compliance_critic'],
  politics_regulation: ['political_regulatory_analyst', 'risk_compliance_critic'],
  business_strategy: ['business_strategist', 'finance_expert', 'execution_operator'],
  memory_update: [],
  research: ['research_analyst'],
  general: ['execution_operator'],
};

export function buildProviderStrategy(
  intent: AgentIntent,
  runtimePath: RuntimePath,
  stakes: RiskLevel,
  needsResearch: boolean,
  needsMemory: boolean,
): ProviderStrategy {
  let model: string;
  let specialists: string[] = [];
  let maxProviderCalls: number;
  let maxLatencyMs: number;

  switch (runtimePath) {
    case 'fast_path':
      model = aiConfig.fastModel;
      maxProviderCalls = 1;
      maxLatencyMs = 5000;
      break;
    case 'deep_path':
      model = aiConfig.judgeModel;
      // Cap the council to the most relevant specialists for this intent.
      specialists = SPECIALISTS_BY_INTENT[intent].slice(0, 4);
      maxProviderCalls = 8;
      maxLatencyMs = 45000;
      break;
    case 'standard_path':
    default:
      model = aiConfig.defaultModel;
      // One targeted specialist at most on the standard path.
      specialists = SPECIALISTS_BY_INTENT[intent].slice(0, 1);
      maxProviderCalls = 4;
      maxLatencyMs = 15000;
      break;
  }

  return {
    runtimeClass: runtimePath,
    specialists,
    requiresResearch: needsResearch,
    requiresMemory: needsMemory,
    maxProviderCalls,
    maxLatencyMs,
    model,
    reason: `${runtimePath}: model=${model} specialists=${specialists.length} stakes=${stakes}`,
  };
}

/**
 * Resolve the ordered failover chain of user-configured credentials
 * (default-first). Empty → env keys → stub. The council/synthesizer walk this
 * list so a rate-limited default falls through to the next working provider.
 */
export async function resolveStrategyCredentials(
  supabase: SupabaseClient,
  userId: string,
): Promise<AICredential[]> {
  return resolveUserCredentials(supabase, userId);
}

/** The provider name that will actually be used, for logging/summaries. */
export function effectiveProviderName(credentials: AICredential[]): string {
  return credentials[0]?.provider ?? activeProvider();
}
