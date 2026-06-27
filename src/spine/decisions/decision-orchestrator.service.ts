/**
 * Decision Orchestrator — real LLM wiring.
 *
 * Builds decision context, redacts it, runs the advisor panel via the AI
 * provider abstraction, and synthesizes a final recommendation using the
 * Final Judge advisor. Falls back to deterministic stubs when no AI provider
 * key is present so the full pipeline is always testable.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
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
import { callAI, activeProvider, modelForAdvisor } from '../ai/provider';
import {
  buildAdvisorPrompt,
  parseAdvisorResponse,
} from '../ai/advisor-prompts';

/**
 * Builds a decision context from the stored decision. Module-specific context
 * enrichment is added by the module registry; here we provide a baseline from
 * the decision record itself.
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

/** Asserts no high-risk secrets in the original context, then redacts it. */
export function redactSensitiveContext(context: DecisionContext): DecisionContext {
  // Gate runs on the ORIGINAL before redaction — a redacted SSN must not pass through.
  assertNoHighRiskSecrets(JSON.stringify(context));
  return redactDecisionContext(context);
}

/**
 * Calls a single advisor via the AI provider (or returns a stub when no
 * provider is configured).
 */
async function callAdvisor(
  role: (typeof ADVISOR_PANEL)[number]['role'],
  advisorName: string,
  preferredModel: string | undefined,
  question: string,
  redactedCtx: DecisionContext,
  priorVotes?: Array<{ role: string; recommendation: string; confidence: number }>,
): Promise<AdvisorOutput> {
  const provider = activeProvider();
  const model = modelForAdvisor(preferredModel, provider);
  const { systemPrompt, userPrompt } = buildAdvisorPrompt(
    role,
    question,
    redactedCtx,
    priorVotes,
  );

  let raw: string;
  if (provider === 'stub') {
    raw = JSON.stringify({
      recommendation: `Stub ${advisorName} recommendation (no AI provider configured).`,
      reasoning: `Evaluated through the lens: ${redactedCtx.summary.slice(0, 200)}`,
      confidence: 0.5,
      risks: 'Stub risk assessment — connect a provider for real analysis.',
      next_actions: ['Configure ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local'],
    });
  } else {
    const response = await callAI(
      [{ role: 'user', content: userPrompt }],
      { systemPrompt, model, maxTokens: 1024, temperature: 0.3 },
    );
    raw = response.text;
    logger.info('advisor_call', { role, provider, model, outputTokens: response.outputTokens });
  }

  const parsed = parseAdvisorResponse(raw);
  return {
    role,
    advisorName,
    modelName: provider !== 'stub' ? model : null,
    recommendation: parsed.recommendation,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    risks: parsed.risks,
    nextActions: parsed.next_actions,
    redactionsApplied: true,
  };
}

/**
 * Runs the advisor panel. Each non-judge advisor runs in parallel; the Final
 * Judge receives all votes as context and runs last. All votes are persisted
 * via decision.service.
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

  const full = await getDecisionWithVotes(supabase, userId, decisionId);
  if (!full.ok) return full;
  const question = full.data.question;

  const provider = activeProvider();
  logger.info('runAdvisorPanel', { decisionId, provider });

  // Run all non-judge advisors in parallel; convert any thrown provider
  // error (bad key, timeout, rate-limit) into an AppResult so the reset
  // path in runFullDecisionAnalysis fires correctly.
  const panelAdvisors = ADVISOR_PANEL.filter((a) => a.role !== 'final_judge');
  let panelOutputs: AdvisorOutput[];
  try {
    panelOutputs = await Promise.all(
      panelAdvisors.map((advisor) =>
        callAdvisor(advisor.role, advisor.name, advisor.preferredModel, question, redacted),
      ),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(appError('ai_provider_error', `Advisor panel failed: ${msg}`));
  }

  // Persist panel votes
  const outputs: AdvisorOutput[] = [];
  for (const output of panelOutputs) {
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
    if (!saved.ok) return saved;
    outputs.push(output);
  }

  return ok(outputs);
}

/**
 * Runs the Final Judge advisor with all prior panel votes as context, then
 * finalizes the decision. The Final Judge synthesizes the panel into one
 * coherent recommendation.
 */
export async function synthesizeFinalRecommendation(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
): Promise<AppResult<FinalRecommendation>> {
  const full = await getDecisionWithVotes(supabase, userId, decisionId);
  if (!full.ok) return full;

  const ctxResult = await buildDecisionContext(supabase, userId, decisionId);
  if (!ctxResult.ok) return ctxResult;

  let redacted: DecisionContext;
  try {
    redacted = redactSensitiveContext(ctxResult.data);
  } catch {
    return err(appError('redaction_blocked', 'Context failed redaction gate.'));
  }

  const votes = full.data.votes;
  const priorVotes = votes.map((v) => ({
    role: v.advisor_role,
    recommendation: v.recommendation,
    confidence: v.confidence ?? 0.5,
  }));

  const judgeAdvisor = ADVISOR_PANEL.find((a) => a.role === 'final_judge')!;
  let judgeOutput: AdvisorOutput;
  try {
    judgeOutput = await callAdvisor(
      judgeAdvisor.role,
      judgeAdvisor.name,
      judgeAdvisor.preferredModel,
      full.data.question,
      redacted,
      priorVotes,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(appError('ai_provider_error', `Final Judge failed: ${msg}`));
  }

  // Persist the final judge vote
  const savedJudge = await addAdvisorVote(supabase, userId, decisionId, {
    advisor_name: judgeOutput.advisorName,
    advisor_role: judgeOutput.role,
    model_name: judgeOutput.modelName,
    recommendation: judgeOutput.recommendation,
    reasoning: judgeOutput.reasoning,
    confidence: judgeOutput.confidence,
    risks: judgeOutput.risks,
    next_actions: judgeOutput.nextActions,
    redactions_applied: true,
  });
  if (!savedJudge.ok) return savedJudge;

  // Derive risk/upside from panel vote distribution
  const avgConfidence =
    priorVotes.length > 0
      ? priorVotes.reduce((s, v) => s + v.confidence, 0) / priorVotes.length
      : judgeOutput.confidence;

  const riskLevel = avgConfidence < 0.4 ? 'high' : avgConfidence < 0.65 ? 'medium' : 'low';
  const upsideLevel = avgConfidence >= 0.7 ? 'high' : avgConfidence >= 0.45 ? 'medium' : 'low';

  const final: FinalRecommendation = {
    recommendation: judgeOutput.recommendation,
    confidence: judgeOutput.confidence,
    riskLevel,
    upsideLevel,
    rationale: judgeOutput.reasoning,
  };

  const fin = await finalizeDecision(supabase, userId, decisionId, final.recommendation, {
    confidence: final.confidence,
    risk_level: final.riskLevel,
    upside_level: final.upsideLevel,
  });
  if (!fin.ok) return fin;

  return ok(final);
}

/**
 * Full decision run: build context → run panel → synthesize → finalize.
 * Single entry point for kicking off a complete analysis.
 */
export async function runFullDecisionAnalysis(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
): Promise<
  AppResult<{
    advisorOutputs: AdvisorOutput[];
    finalRecommendation: FinalRecommendation;
  }>
> {
  // Capture prior status so we can restore it on failure — avoids
  // unarchiving or unfinalizing a decision that was never re-analyzed.
  const { data: prior } = await supabase
    .from('decisions')
    .select('status')
    .eq('id', decisionId)
    .eq('user_id', userId)
    .single();

  const priorStatus = (prior?.status as string | undefined) ?? 'draft';

  // Block terminal and already-running statuses. 'analyzing' is rejected to
  // prevent concurrent runs from inserting duplicate votes and racing on
  // synthesizeFinalRecommendation / finalizeDecision.
  if (priorStatus === 'archived' || priorStatus === 'decided' || priorStatus === 'analyzing') {
    return err(appError('invalid_state', `Cannot analyze a ${priorStatus} decision.`));
  }

  const restorePriorStatus = () =>
    supabase
      .from('decisions')
      .update({ status: priorStatus })
      .eq('id', decisionId)
      .eq('user_id', userId);

  // Delete all votes for the decision so a retry starts clean. Without this,
  // partial runs leave stale panel votes in the table and synthesizeFinalRecommendation
  // would include them in the next judge's context.
  const deleteVotes = () =>
    supabase.from('decision_votes').delete().eq('decision_id', decisionId);

  const rollback = async () => {
    await Promise.all([restorePriorStatus(), deleteVotes()]);
  };

  // Atomic draft→analyzing claim: the extra .eq('status','draft') means only
  // one concurrent request succeeds; others get 0 rows back and return 409.
  const { data: claimed } = await supabase
    .from('decisions')
    .update({ status: 'analyzing' })
    .eq('id', decisionId)
    .eq('user_id', userId)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();

  if (!claimed) {
    return err(appError('invalid_state', 'Decision is already being analyzed or is not in draft state.'));
  }

  const panelResult = await runAdvisorPanel(supabase, userId, decisionId);
  if (!panelResult.ok) {
    await rollback();
    return panelResult;
  }

  const synthResult = await synthesizeFinalRecommendation(supabase, userId, decisionId);
  if (!synthResult.ok) {
    await rollback();
    return synthResult;
  }

  return ok({
    advisorOutputs: panelResult.data,
    finalRecommendation: synthResult.data,
  });
}
