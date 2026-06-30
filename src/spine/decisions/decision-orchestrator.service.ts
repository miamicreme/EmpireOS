/**
 * Decision Orchestrator — multi-advisor decision pipeline.
 *
 * Builds decision context, redacts it, runs the advisor panel through the AI
 * provider abstraction, persists advisor votes, synthesizes a Final Judge
 * recommendation, and finalizes the decision. The provider layer falls back to
 * deterministic stubs when no AI key is configured so the pipeline remains
 * testable without external services.
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
 * Builds a baseline decision context from the stored decision row. Module-level
 * context enrichment can be layered in later through the module registry.
 */
export async function buildDecisionContext(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
): Promise<AppResult<DecisionContext>> {
  const full = await getDecisionWithVotes(supabase, userId, decisionId);
  if (!full.ok) return full;

  return ok({
    moduleId: 'spine',
    summary: full.data.context ?? full.data.question,
    facts: {
      title: full.data.title,
      question: full.data.question,
      decisionType: full.data.decision_type,
      status: full.data.status,
      optionCount: full.data.options.length,
      existingVoteCount: full.data.votes.length,
    },
    risks: [],
    opportunities: [],
    recommendedActions: [],
  });
}

/**
 * Final safety gate before any context reaches an external provider.
 */
export function redactSensitiveContext(context: DecisionContext): DecisionContext {
  assertNoHighRiskSecrets(JSON.stringify(context));
  return redactDecisionContext(context);
}

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
      reasoning: `Evaluated through the ${advisorName} lens using redacted context: ${redactedCtx.summary.slice(0, 240)}`,
      confidence: 0.5,
      risks: 'Stub risk assessment — configure an AI provider for model-backed analysis.',
      next_actions: ['Configure ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY in .env.local'],
    });
  } else {
    const response = await callAI(
      [{ role: 'user', content: userPrompt }],
      { systemPrompt, model, maxTokens: 1024, temperature: 0.3 },
    );
    raw = response.text;
    logger.info('advisor_call', {
      role,
      provider,
      model,
      outputTokens: response.outputTokens,
    });
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
 * Runs the non-judge advisors in parallel and persists each advisor vote.
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

  const panelAdvisors = ADVISOR_PANEL.filter((advisor) => advisor.role !== 'final_judge');

  let panelOutputs: AdvisorOutput[];
  try {
    panelOutputs = await Promise.all(
      panelAdvisors.map((advisor) =>
        callAdvisor(
          advisor.role,
          advisor.name,
          advisor.preferredModel,
          question,
          redacted,
        ),
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(appError('ai_provider_error', `Advisor panel failed: ${message}`));
  }

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
 * Runs the Final Judge after the advisor panel and finalizes the decision.
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

  const priorVotes = full.data.votes
    .filter((vote) => vote.advisor_role !== 'final_judge')
    .map((vote) => ({
      role: vote.advisor_role,
      recommendation: vote.recommendation,
      confidence: vote.confidence ?? 0.5,
    }));

  const judgeAdvisor = ADVISOR_PANEL.find((advisor) => advisor.role === 'final_judge');
  if (!judgeAdvisor) {
    return err(appError('internal', 'Final Judge advisor is not registered.'));
  }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(appError('ai_provider_error', `Final Judge failed: ${message}`));
  }

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

  const avgConfidence =
    priorVotes.length > 0
      ? priorVotes.reduce((sum, vote) => sum + vote.confidence, 0) / priorVotes.length
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

  const finalized = await finalizeDecision(supabase, userId, decisionId, final.recommendation, {
    confidence: final.confidence,
    risk_level: final.riskLevel,
    upside_level: final.upsideLevel,
  });
  if (!finalized.ok) return finalized;

  return ok(final);
}

/**
 * Full decision run: build context → run panel → synthesize → finalize.
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
  const { data: prior } = await supabase
    .from('decisions')
    .select('status')
    .eq('id', decisionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!prior) return err(appError('not_found', 'Decision not found.'));
  const priorStatus = prior.status as string;

  if (priorStatus === 'archived' || priorStatus === 'decided' || priorStatus === 'analyzing') {
    return err(appError('invalid_state', `Cannot analyze a ${priorStatus} decision.`));
  }

  const restorePriorStatus = () =>
    supabase
      .from('decisions')
      .update({ status: priorStatus })
      .eq('id', decisionId)
      .eq('user_id', userId);

  // decision_votes has no user_id column; RLS scopes deletes to the caller's
  // own votes via the parent decisions.user_id, so filtering by decision_id is
  // safe (a foreign decision id matches no rows for this user).
  const deleteVotes = () =>
    supabase.from('decision_votes').delete().eq('decision_id', decisionId);

  // Surface rollback failures instead of letting them vanish — a silently
  // failed rollback leaves the decision stuck in 'analyzing' and un-retryable.
  const rollback = async () => {
    const [restore, votes] = await Promise.all([restorePriorStatus(), deleteVotes()]);
    if (restore.error || votes.error) {
      console.error(
        '[decision-orchestrator] rollback failed:',
        restore.error?.message ?? votes.error?.message,
      );
    }
  };

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

  await deleteVotes();

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
