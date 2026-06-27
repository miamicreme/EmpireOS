/**
 * Decision Orchestrator (V3 stubs).
 *
 * Builds decision context, redacts it, runs the advisor panel, and synthesizes
 * a final recommendation. Real LLM calls are intentionally NOT wired here —
 * they land in feature/decision-engine-v3. When no AI provider keys are present
 * the panel returns deterministic placeholder votes so the pipeline is testable.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { hasAnyAiProvider } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { DecisionContext } from '../types';
import {
  ADVISOR_PANEL,
  type AdvisorOutput,
  type FinalRecommendation,
} from './advisor.types';
import {
  assertNoHighRiskSecrets,
  redactDecisionContext,
} from './context-redaction.service';
import { addAdvisorVote, finalizeDecision, getDecisionWithVotes } from './decision.service';

/**
 * Builds a decision context from the stored decision. Module-specific context
 * enrichment is added by the module registry in a later phase; here we provide
 * a baseline from the decision record itself.
 */
export async function buildDecisionContext(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
): Promise<AppResult<DecisionContext>> {
  const full = await getDecisionWithVotes(supabase, userId, decisionId);
  if (!full.ok) return full;

  const context: DecisionContext = {
    moduleId: 'spine',
    summary: full.data.context ?? full.data.question,
    facts: { title: full.data.title, decisionType: full.data.decision_type },
    risks: [],
    opportunities: [],
    recommendedActions: [],
  };
  return ok(context);
}

/** Redacts a context and asserts no high-risk secrets survive. */
export function redactSensitiveContext(context: DecisionContext): DecisionContext {
  const redacted = redactDecisionContext(context);
  assertNoHighRiskSecrets(JSON.stringify(redacted));
  return redacted;
}

/**
 * Runs the advisor panel. V3: deterministic stub votes (no external calls)
 * unless a provider is configured, in which case this is where real model calls
 * will be added. Votes are persisted via decision.service.
 */
export async function runAdvisorPanel(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
): Promise<AppResult<AdvisorOutput[]>> {
  const ctxResult = await buildDecisionContext(supabase, userId, decisionId);
  if (!ctxResult.ok) return ctxResult;

  let redacted: DecisionContext;
  try {
    redacted = redactSensitiveContext(ctxResult.data);
  } catch {
    return err(appError('redaction_blocked', 'Context failed redaction gate.'));
  }

  const usingAi = hasAnyAiProvider();
  logger.info('runAdvisorPanel', { decisionId, usingAi });

  const outputs: AdvisorOutput[] = [];
  // The final judge synthesizes; it does not vote as a panelist here.
  for (const advisor of ADVISOR_PANEL.filter((a) => a.role !== 'final_judge')) {
    const output: AdvisorOutput = {
      role: advisor.role,
      advisorName: advisor.name,
      modelName: usingAi ? (advisor.preferredModel ?? 'pending') : null,
      recommendation: usingAi
        ? 'pending: connect provider in feature/decision-engine-v3'
        : `Stub ${advisor.name} recommendation (no AI provider configured).`,
      reasoning: `Evaluated through the lens of ${advisor.lens}. Summary: ${redacted.summary}`,
      confidence: 0.5,
      risks: 'Stub risk assessment.',
      nextActions: [],
      redactionsApplied: true,
    };
    const saved = await addAdvisorVote(supabase, userId, decisionId, {
      advisor_name: output.advisorName,
      advisor_role: output.role,
      model_name: output.modelName,
      recommendation: output.recommendation,
      reasoning: output.reasoning,
      confidence: output.confidence,
      risks: output.risks,
      next_actions: output.nextActions,
      redactions_applied: true,
    });
    if (saved.ok) outputs.push(output);
  }

  return ok(outputs);
}

/**
 * Synthesizes a final recommendation from the recorded advisor votes and
 * finalizes the decision. V3: simple aggregation; the real Final Judge model is
 * wired later.
 */
export async function synthesizeFinalRecommendation(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
): Promise<AppResult<FinalRecommendation>> {
  const full = await getDecisionWithVotes(supabase, userId, decisionId);
  if (!full.ok) return full;

  const votes = full.data.votes;
  const avgConfidence =
    votes.length > 0
      ? votes.reduce((s, v) => s + (v.confidence ?? 0), 0) / votes.length
      : 0.5;

  const final: FinalRecommendation = {
    recommendation:
      votes.length > 0
        ? `Synthesis of ${votes.length} advisor votes. Connect Final Judge model in feature/decision-engine-v3 for full reasoning.`
        : 'No advisor votes recorded yet.',
    confidence: Number(avgConfidence.toFixed(2)),
    riskLevel: 'medium',
    upsideLevel: 'medium',
    rationale: 'Aggregated from advisor panel (V3 stub synthesis).',
  };

  const fin = await finalizeDecision(supabase, userId, decisionId, final.recommendation);
  if (!fin.ok) return fin;

  return ok(final);
}
