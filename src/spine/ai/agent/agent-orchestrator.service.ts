/**
 * Agent orchestrator — the one runtime behind POST /api/ai/agent/run.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type AppResult } from '@/lib/result';
import { logger } from '@/lib/logger';
import { routeIntent } from './intent-router.service';
import { buildContextPack } from './context-pack.service';
import { evaluateMemoryGate } from './memory-gate.service';
import { evaluateResearchGate } from './research-gate.service';
import {
  buildProviderStrategy,
  resolveStrategyCredentials,
  effectiveProviderName,
} from './provider-router.service';
import { runSpecialistCouncil } from './specialist-council.service';
import { synthesizeFinal } from './final-synthesizer.service';
import { buildReasoningArtifact } from './reasoning-artifact.service';
import * as repo from './agent-repository.service';
import type {
  AgentActionDraftView,
  AgentRunInput,
  AgentRunOutput,
  RunStatus,
  SpecialistVote,
} from './agent.types';

function toDraftView(d: repo.AgentActionDraftRow): AgentActionDraftView {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    category: d.category,
    priority: d.priority,
    reason: d.reason,
    approvalStatus: d.approval_status,
  };
}

export async function runAgent(
  supabase: SupabaseClient,
  userId: string,
  input: AgentRunInput,
): Promise<AppResult<AgentRunOutput>> {
  const startedAt = Date.now();

  if (input.idempotency) {
    const existing = await repo.findRunByIdempotency(supabase, userId, input.idempotency);
    if (existing) {
      return ok(
        await reconstructOutput(
          supabase,
          userId,
          existing,
          existing.thread_id ?? input.threadId ?? '',
        ),
      );
    }
  }

  const thread = await repo.upsertThread(supabase, userId, {
    threadId: input.threadId,
    mode: input.modeHint ?? 'general',
  });
  if (!thread.ok) return thread;

  const runResult = await repo.createRun(supabase, userId, {
    threadId: thread.data.id,
    command: input.command,
    idempotencyKey: input.idempotency,
  });
  if (!runResult.ok) return runResult;
  if (runResult.data.reused) {
    return ok(
      await reconstructOutput(
        supabase, userId, runResult.data.run, runResult.data.run.thread_id ?? thread.data.id,
      ),
    );
  }
  const runId = runResult.data.run.id;

  let order = 0;
  const event = (type: Parameters<typeof repo.appendEvent>[4], summary?: string, payload?: Record<string, unknown>) =>
    repo.appendEvent(supabase, userId, runId, order++, type, { summary, payload });

  const failRun = async (message: string): Promise<void> => {
    await repo.appendEvent(supabase, userId, runId, order++, 'error', { summary: message, status: 'failed' });
    await repo.finalizeRun(supabase, userId, runId, {
      status: 'failed',
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
    });
  };

  try {
    const route = routeIntent({
      command: input.command,
      moduleHint: input.moduleHint,
      artifactTypeHint: input.artifactTypeHint,
      runtimePreference: input.runtimePreference,
      goDeeper: input.goDeeper,
    });
    await event('intent_detected', route.reason, { intent: route.intent, tags: route.tags });
    await event('capability_plan', 'read_internal_data, build_context_pack, reason, draft_actions');
    await event('permission_check', 'reads approved; external actions are draft-only (approval-gated)');

    const inputArtifacts = input.inputArtifactIds?.length
      ? await repo.getArtifactsByIds(supabase, userId, input.inputArtifactIds)
      : ok([] as repo.ArtifactRow[]);
    if (!inputArtifacts.ok) {
      await failRun(inputArtifacts.error.message);
      return inputArtifacts;
    }
    if (inputArtifacts.data.length) {
      await event('tool_run', `${inputArtifacts.data.length} analyzed input artifact(s) attached to context`, {
        inputArtifactIds: inputArtifacts.data.map((artifact) => artifact.id),
        inputArtifactSummaries: inputArtifacts.data.map((artifact) => ({
          id: artifact.id,
          artifactType: artifact.artifact_type,
          title: artifact.title,
          summary: artifact.summary,
        })),
      });
    }

    const credentialPromise = resolveStrategyCredentials(supabase, userId);

    const packResult = await buildContextPack(supabase, userId, route.intent);
    if (!packResult.ok) {
      await failRun(packResult.error.message);
      return packResult;
    }
    const { pack, context } = packResult.data;
    const inputArtifactSummary = inputArtifacts.data
      .map((artifact) => `${artifact.artifact_type}: ${artifact.title ?? 'Untitled'} — ${artifact.summary ?? ''}`)
      .join('\n');
    if (inputArtifactSummary) {
      pack.relevantFacts = { ...pack.relevantFacts, attachedInputArtifacts: inputArtifactSummary };
      pack.sourceRefs = [...pack.sourceRefs, ...inputArtifacts.data.map((artifact) => `agent_artifact:${artifact.id}`)];
      pack.summary = `${pack.summary} Attached inputs: ${inputArtifacts.data.length}.`;
    }
    await event('context_built', pack.summary, { contextHash: pack.contextHash, tokenEstimate: pack.tokenEstimate, inputArtifactCount: inputArtifacts.data.length });

    const existingPack = await repo.findContextPackByHash(supabase, userId, pack.contextHash);
    if (!existingPack) {
      await repo.saveContextPack(supabase, userId, runId, pack);
    }

    const memoryRequests = evaluateMemoryGate(context, route.intent, route.stakes);
    await event('memory_gate', `${memoryRequests.length} memory question(s)`);

    const research = evaluateResearchGate(input.command, route.intent, Boolean(input.useResearch));
    await event('research_gate', research.needsResearch ? 'research required' : 'no research needed');
    await event('problem_framed', `${route.intent} objective framed at ${route.stakes} stakes`, {
      intent: route.intent,
      stakes: route.stakes,
      needsMemory: memoryRequests.length > 0,
      needsResearch: research.needsResearch,
    });

    const strategy = buildProviderStrategy(
      route.intent,
      route.runtimePath,
      route.stakes,
      research.needsResearch,
      memoryRequests.length > 0,
    );
    const credentials = await credentialPromise;
    const providerName = effectiveProviderName(credentials);
    await event('provider_selected', strategy.reason, { provider: providerName, model: strategy.model });

    let votes: SpecialistVote[] = [];
    if (route.runtimePath === 'deep_path' && strategy.specialists.length > 0) {
      votes = await runSpecialistCouncil(
        supabase, userId, runId, strategy.specialists, pack, input.command, strategy.model, credentials,
      );
      for (const v of votes) {
        await repo.appendEvent(supabase, userId, runId, order++, 'specialist_vote', {
          summary: `${v.specialist}: ${v.recommendation.slice(0, 120)}`,
          status: v.status === 'invalid_output' ? 'invalid_output' : 'complete',
          payload: { specialist: v.specialist, confidence: v.confidence },
        });
      }
    }

    const synth = await synthesizeFinal(
      supabase, userId, runId, input.command, pack, context, votes, strategy.model, route.runtimePath, credentials,
    );
    const out = synth.output;
    const reasoningArtifact = buildReasoningArtifact({
      command: input.command,
      intent: route.intent,
      stakes: route.stakes,
      pack,
      context,
      memoryRequests,
      researchRequests: research.requests,
      votes,
      output: out,
    });
    await event('final_synthesized', out.answer.slice(0, 160), { confidence: out.confidence, operatingMode: out.operatingMode });

    const artifact = await repo.saveArtifact(supabase, userId, runId, {
      artifactType: route.artifactType,
      title: out.answer.slice(0, 120),
      summary: out.reasoningSummary,
      contentJson: {
        answer: out.answer,
        jarvisBrief: out.jarvisBrief,
        operatingMode: out.operatingMode,
        realIssue: out.realIssue,
        mentorNote: out.mentorNote,
        issueBreakdown: out.issueBreakdown,
        leverageMap: out.leverageMap,
        blindSpots: out.blindSpots,
        antiPatterns: out.antiPatterns,
        decisionPath: out.decisionPath,
        creativeAngles: out.creativeAngles,
        conversationStarters: out.conversationStarters,
        nextBestQuestion: out.nextBestQuestion,
        reasoningSummary: out.reasoningSummary,
        reasoningArtifact,
        assumptions: reasoningArtifact.assumptions,
        evidence: reasoningArtifact.evidence,
        options: reasoningArtifact.options,
        whatWouldChangeMyMind: reasoningArtifact.whatWouldChangeMyMind,
        risks: out.risks,
        opportunities: out.opportunities,
        nextActions: out.nextActions,
        specialistVotes: votes.filter((v) => v.status === 'valid'),
        researchRequests: research.requests,
        memoryRequests,
        inputArtifacts: inputArtifacts.data.map((artifact) => ({
          id: artifact.id,
          artifactType: artifact.artifact_type,
          title: artifact.title,
          summary: artifact.summary,
          content: artifact.content_json,
        })),
      },
      confidence: out.confidence,
      riskLevel: out.riskLevel,
    });
    if (!artifact.ok) {
      await failRun(artifact.error.message);
      return artifact;
    }

    const draftsResult = await repo.createActionDrafts(
      supabase, userId, runId, artifact.data.id, out.suggestedDrafts,
    );
    const drafts = draftsResult.ok ? draftsResult.data : [];
    if (drafts.length > 0) {
      await event('action_drafts_created', `${drafts.length} action draft(s)`);
    } else if (!draftsResult.ok) {
      await repo.appendEvent(supabase, userId, runId, order++, 'error', {
        summary: `action draft creation failed: ${draftsResult.error.message}`,
        status: 'failed',
      });
    }

    const status: RunStatus = research.needsResearch
      ? 'blocked_research_required'
      : memoryRequests.length > 0
        ? 'blocked_memory_required'
        : drafts.length > 0
          ? 'blocked_approval_required'
          : 'complete';
    const latencyMs = Date.now() - startedAt;
    await repo.finalizeRun(supabase, userId, runId, {
      status,
      intent: route.intent,
      runtimePath: route.runtimePath,
      finalSummary: out.answer,
      confidence: out.confidence,
      riskLevel: out.riskLevel,
      needsMemory: memoryRequests.length > 0,
      needsResearch: research.needsResearch,
      needsApproval: drafts.length > 0,
      latencyMs,
    });

    return ok({
      runId,
      threadId: thread.data.id,
      runtimePath: route.runtimePath,
      status,
      intent: route.intent,
      artifactId: artifact.data.id,
      artifactType: route.artifactType,
      answer: out.answer,
      jarvisBrief: out.jarvisBrief,
      operatingMode: out.operatingMode,
      realIssue: out.realIssue,
      mentorNote: out.mentorNote,
      issueBreakdown: out.issueBreakdown,
      leverageMap: out.leverageMap,
      blindSpots: out.blindSpots,
      antiPatterns: out.antiPatterns,
      decisionPath: out.decisionPath,
      creativeAngles: out.creativeAngles,
      conversationStarters: out.conversationStarters,
      nextBestQuestion: out.nextBestQuestion,
      reasoningSummary: out.reasoningSummary,
      reasoningArtifact,
      confidence: out.confidence,
      riskLevel: out.riskLevel,
      risks: out.risks,
      opportunities: out.opportunities,
      nextActions: out.nextActions,
      actionDrafts: drafts.map(toDraftView),
      memoryRequests,
      researchRequests: research.requests,
      specialistVotes: votes
        .filter((v) => v.status === 'valid')
        .map((v) => ({ specialist: v.specialist, recommendation: v.recommendation, confidence: v.confidence })),
      providerSummary: {
        providersUsed: [providerName],
        fallbackUsed: false,
        latencyMs,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('agent_run_failed', { runId, error: message });
    await repo.appendEvent(supabase, userId, runId, order++, 'error', { summary: message, status: 'failed' });
    await repo.finalizeRun(supabase, userId, runId, {
      status: 'failed',
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
    });
    return ok({
      runId,
      threadId: thread.data.id,
      runtimePath: 'fast_path',
      status: 'failed',
      intent: 'general',
      artifactId: null,
      artifactType: 'answer',
      answer: 'The agent run failed. Please try again.',
      jarvisBrief: '',
      operatingMode: '',
      realIssue: '',
      mentorNote: '',
      issueBreakdown: [],
      leverageMap: [],
      blindSpots: [],
      antiPatterns: [],
      decisionPath: [],
      creativeAngles: [],
      conversationStarters: [],
      nextBestQuestion: '',
      reasoningSummary: '',
      reasoningArtifact: null,
      confidence: 0,
      riskLevel: 'low',
      risks: [],
      opportunities: [],
      nextActions: [],
      actionDrafts: [],
      memoryRequests: [],
      researchRequests: [],
      specialistVotes: [],
      providerSummary: { providersUsed: [], fallbackUsed: false, latencyMs: Date.now() - startedAt },
    });
  }
}

async function reconstructOutput(
  supabase: SupabaseClient,
  userId: string,
  run: repo.RunRow,
  threadId: string,
): Promise<AgentRunOutput> {
  const { data: artifactRow } = await supabase
    .from('agent_artifacts')
    .select('*')
    .eq('run_id', run.id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const content = (artifactRow as repo.ArtifactRow | null)?.content_json as Record<string, unknown> | undefined;

  const { data: draftRows } = await supabase
    .from('agent_action_drafts')
    .select('*')
    .eq('run_id', run.id)
    .eq('user_id', userId);

  return {
    runId: run.id,
    threadId,
    runtimePath: run.runtime_path,
    status: run.status,
    intent: (run.intent as AgentRunOutput['intent']) ?? 'general',
    artifactId: (artifactRow as repo.ArtifactRow | null)?.id ?? null,
    artifactType: ((artifactRow as repo.ArtifactRow | null)?.artifact_type as AgentRunOutput['artifactType']) ?? 'answer',
    answer: run.final_summary ?? (content?.answer as string) ?? '',
    jarvisBrief: (content?.jarvisBrief as string) ?? '',
    operatingMode: (content?.operatingMode as string) ?? '',
    realIssue: (content?.realIssue as string) ?? '',
    mentorNote: (content?.mentorNote as string) ?? '',
    issueBreakdown: (content?.issueBreakdown as AgentRunOutput['issueBreakdown']) ?? [],
    leverageMap: (content?.leverageMap as AgentRunOutput['leverageMap']) ?? [],
    blindSpots: (content?.blindSpots as string[]) ?? [],
    antiPatterns: (content?.antiPatterns as string[]) ?? [],
    decisionPath: (content?.decisionPath as AgentRunOutput['decisionPath']) ?? [],
    creativeAngles: (content?.creativeAngles as string[]) ?? [],
    conversationStarters: (content?.conversationStarters as string[]) ?? [],
    nextBestQuestion: (content?.nextBestQuestion as string) ?? '',
    reasoningSummary: (content?.reasoningSummary as string) ?? '',
    reasoningArtifact: (content?.reasoningArtifact as AgentRunOutput['reasoningArtifact']) ?? null,
    confidence: run.confidence ?? 0.5,
    riskLevel: (run.risk_level as AgentRunOutput['riskLevel']) ?? 'low',
    risks: (content?.risks as string[]) ?? [],
    opportunities: (content?.opportunities as string[]) ?? [],
    nextActions: (content?.nextActions as AgentRunOutput['nextActions']) ?? [],
    actionDrafts: ((draftRows ?? []) as repo.AgentActionDraftRow[]).map(toDraftView),
    memoryRequests: [],
    researchRequests: [],
    specialistVotes: [],
    providerSummary: { providersUsed: [], fallbackUsed: false, latencyMs: run.latency_ms ?? 0 },
  };
}
