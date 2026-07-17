import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runStructured } from '@/spine/ai/ai-runner';
import { resolveStrategyCredentials } from '@/spine/ai/agent/provider-router.service';

const conductorDecisionSchema = z.object({
  responseMode: z.enum(['direct', 'delegated']).catch('direct'),
  runtimePreference: z.enum(['fast', 'standard', 'deep']).catch('standard'),
  useResearch: z.boolean().catch(false),
  goDeeper: z.boolean().catch(false),
  moduleHint: z
    .enum(['cash-engine', 'job-hunt', 'followup-crm', 'credit-funding', 'projects', 'acquisitions'])
    .nullable()
    .catch(null),
  delegatedTasks: z
    .array(
      z.object({
        agent: z.string().min(1).max(80),
        task: z.string().min(1).max(500),
        reason: z.string().min(1).max(500),
      }),
    )
    .max(5)
    .catch([]),
  decisionSummary: z.string().max(1000).catch('Handle through the canonical Empire intelligence runtime.'),
});

export type EmpireConductorDecision = z.infer<typeof conductorDecisionSchema>;

function fallbackDecision(message: string): EmpireConductorDecision {
  const complex = /compare|trade.?off|analy[sz]e|strategy|plan|decide|evaluate|research|multiple|options/i.test(message);
  const highStakes = /credit|loan|legal|compliance|investment|stock|real estate|acquisition|medical/i.test(message);
  return {
    responseMode: complex || highStakes ? 'delegated' : 'direct',
    runtimePreference: highStakes ? 'deep' : complex ? 'standard' : 'fast',
    useResearch: /latest|current|today'?s news|research|market data/i.test(message),
    goDeeper: highStakes,
    moduleHint: null,
    delegatedTasks: complex
      ? [{ agent: 'execution_operator', task: 'Break the request into the smallest useful decision steps.', reason: 'The request benefits from explicit sequencing.' }]
      : [],
    decisionSummary: complex
      ? 'Delegate focused analysis, then synthesize one coherent Empire response.'
      : 'Answer directly through the canonical Empire intelligence runtime.',
  };
}

/**
 * Empire's orchestration brain. It decides whether a turn is simple enough for a
 * direct answer or should be decomposed and delegated to specialist agents.
 * The decision is advisory: all execution still flows through the canonical
 * agent runtime, Tool Gateway, approvals, and receipts.
 */
export async function decideEmpireDelegation(
  supabase: SupabaseClient,
  userId: string,
  message: string,
): Promise<{ decision: EmpireConductorDecision; provider: string; model: string }> {
  const fallback = fallbackDecision(message);
  const credentials = await resolveStrategyCredentials(supabase, userId);
  const run = await runStructured({
    feature: 'empire:conductor',
    systemPrompt: `You are Empire Conductor, the orchestration brain for a governed multi-agent operating system.
Decide how to handle one owner request. Use direct mode for greetings and simple factual/explanatory turns. Use delegated mode when parallel specialist work, trade-off analysis, planning, research, or high-stakes review would materially improve the answer.
Choose at most five small, non-overlapping delegated tasks. Delegated agents may analyze and draft only; they cannot claim external actions happened. Never bypass approvals, tools, receipts, or owner controls.
Return JSON only.`,
    instruction: message,
    context: {
      availableAgents: [
        'finance_expert',
        'business_credit_expert',
        'market_trading_analyst',
        'political_regulatory_analyst',
        'deal_acquisition_analyst',
        'career_income_strategist',
        'risk_compliance_critic',
        'execution_operator',
        'business_strategist',
        'research_analyst',
      ],
      operatingLaw: 'Empire is the sole user-facing orchestrator. Specialists return bounded analysis to Empire for synthesis.',
    },
    schema: conductorDecisionSchema,
    stub: fallback,
    model: 'gpt-4o-mini',
    maxTokens: 700,
    credentials,
  });

  return { decision: run.data, provider: run.provider, model: run.model };
}
