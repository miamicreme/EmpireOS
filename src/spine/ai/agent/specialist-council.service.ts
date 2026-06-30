/**
 * Specialist council — deep path only.
 *
 * Runs the relevant specialists concurrently with Promise.allSettled so one bad
 * vote can't sink the run; each vote is logged as an agent_run_events
 * specialist_vote (invalid JSON → status invalid_output). Stub-safe: with no
 * provider the votes are deterministic placeholders derived from the context.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { runStructured } from '../ai-runner';
import { specialistVoteSchema } from './agent.schemas';
import { logProviderRun } from './agent-repository.service';
import type { AICredential } from '../provider';
import type { ContextPack, SpecialistVote } from './agent.types';

const LENS: Record<string, string> = {
  finance_expert: 'near-term cash flow, liquidity, runway, ROI, leverage, and downside risk',
  business_credit_expert: 'entity readiness, banking relationship, PG exposure, documentation, and application sequence',
  market_trading_analyst: 'thesis, time horizon, invalidation condition, position sizing, and max loss (analysis only — never execute)',
  political_regulatory_analyst: 'current regulatory/political impact on the business, separating fact from opinion',
  deal_acquisition_analyst: 'price vs value, deal structure, seller financing, contingencies, and walk-away points',
  career_income_strategist: 'income ceiling, leverage, and career optionality',
  risk_compliance_critic: 'downside exposure, failure modes, recoverability, and compliance boundaries',
  execution_operator: 'sequencing, dependencies, bottlenecks, and the concrete next steps',
  business_strategist: 'positioning, growth levers, and strategic trade-offs',
  research_analyst: 'what current external facts are required and how to source them',
};

function systemPrompt(specialist: string): string {
  const lens = LENS[specialist] ?? 'your domain expertise';
  return `You are the ${specialist} on an AI reasoning council for a high-agency operator.
Assess the question through this lens: ${lens}.
Use only the facts in the provided context. Be specific; do not invent numbers.
Return ONLY JSON: { "recommendation": "...", "reasoningSummary": "...", "confidence": 0..1, "risks": ["..."], "missingData": ["..."] }`;
}

function stubVote(specialist: string, pack: ContextPack): SpecialistVote {
  return {
    specialist,
    recommendation: `[STUB ${specialist}] ${pack.priorities[0] ?? 'Review the top priority.'}`,
    reasoningSummary: `Evaluated via the ${specialist} lens on the compact context. Configure a provider for live analysis.`,
    confidence: 0.5,
    risks: pack.openRisks.slice(0, 2),
    missingData: [],
    status: 'valid',
  };
}

export async function runSpecialistCouncil(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  specialists: string[],
  pack: ContextPack,
  command: string,
  model: string,
  credential: AICredential | null,
): Promise<SpecialistVote[]> {
  if (specialists.length === 0) return [];

  const results = await Promise.allSettled(
    specialists.map(async (specialist) => {
      const run = await runStructured({
        feature: `specialist:${specialist}`,
        systemPrompt: systemPrompt(specialist),
        instruction: command,
        context: pack as unknown as Record<string, unknown>,
        schema: specialistVoteSchema,
        stub: {
          recommendation: stubVote(specialist, pack).recommendation,
          reasoningSummary: stubVote(specialist, pack).reasoningSummary,
          confidence: 0.5,
          risks: pack.openRisks.slice(0, 2),
          missingData: [],
        },
        model,
        maxTokens: 900,
        credential,
      });

      await logProviderRun(supabase, userId, runId, {
        provider: run.provider,
        model: run.model,
        runtimeClass: 'deep_path',
        feature: `specialist:${specialist}`,
        status: run.provider === 'stub' ? 'stub' : 'success',
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
      });

      const vote: SpecialistVote = {
        specialist,
        recommendation: run.data.recommendation,
        reasoningSummary: run.data.reasoningSummary,
        confidence: run.data.confidence,
        risks: run.data.risks,
        missingData: run.data.missingData,
        status: 'valid',
      };
      return vote;
    }),
  );

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          specialist: specialists[i]!,
          recommendation: '',
          reasoningSummary: 'Specialist produced invalid output.',
          confidence: 0,
          risks: [],
          missingData: [],
          status: 'invalid_output' as const,
        },
  );
}
