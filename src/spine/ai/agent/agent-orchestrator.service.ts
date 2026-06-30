/**
 * Agent orchestrator — the one runtime behind POST /api/ai/agent/run.
 *
 * Flow: thread → run (idempotent) → intent → capability/permission events →
 * compact context pack → memory gate → research gate → provider router →
 * specialist council (deep only) → final synthesizer → artifact → action drafts
 * → finalize. Always saves run + artifact + provider runs; saves pack / drafts /
 * events only when useful. Degrades to deterministic stubs with no provider.
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
  resolveStrategyCredential,
  effectiveProviderName,
} from './provider-router.service';
import { runSpecialistCouncil } from './specialist-council.service';
import { synthesizeFinal } from './final-synthesizer.service';
import * as repo from './agent-repository.service';
import type {
  AgentActionDraftView,
  AgentRunInput,
  AgentRunOutput,
  RunStatus,
  SpecialistVote,
} from './agent.types';

/** Map a persisted action-draft row to the API view (one source of truth). */
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

  // 1. Idempotent replay — short-circuit BEFORE creating a thread, so a retry
  // without a threadId doesn't orphan a fresh thread, and the run is reported
  // under its original thread.
  if (input.idempotency) {
    const existing = await repo.findRunByIdempotency(supabase, userId, input.idempotency);
    if (existing) {
      return ok(await reconstructOutput(supabase, userId, existing, existing.thread_id ?? ''));
    }
  }

  // 2. Thread + run.
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
    // Won by a concurrent request — report the reused run's own thread.
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

  // Mark the run failed (no stale 'running' rows) before returning a DB error.
  const failRun = async (message: string): Promise<void> => {
    await repo.appendEvent(supabase, userId, runId, order++, 'error', { summary: message, status: 'failed' });
    await repo.finalizeRun(supabase, userId, runId, {
      status: 'failed',
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
    });
  };

  try {
    // 2. Intent.
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

    // Resolve the credential in parallel — it depends only on the user, not on
    // the context build or gates below.
    const credentialPromise = resolveStrategyCredential(supabase, userId);

    // 3. Context pack (compact, redacted, hash-reusable).
    const packResult = await buildContextPack(supabase, userId, route.intent);
    if (!packResult.ok) {
      await failRun(packResult.error.message);
      return packResult;
    }
    const { pack, context } = packResult.data;
    await event('context_built', pack.summary, { contextHash: pack.contextHash, tokenEstimate: pack.tokenEstimate });

    // Save the pack only when its hash is new — identical situations reuse the
    // existing pack (hash-reuse avoids churn and duplicate rows).
    const existingPack = await repo.findContextPackByHash(supabase, userId, pack.contextHash);
    if (!existingPack) {
      await repo.saveContextPack(supabase, userId, runId, pack);
    }

    // 4. Memory gate (non-blocking suggestions, ≤2).
    const memoryRequests = evaluateMemoryGate(context, route.intent, route.stakes);
    await event('memory_gate', `${memoryRequests.length} memory question(s)`);

    // 5. Research gate (returns research_required rather than faking facts).
    const research = evaluateResearchGate(input.command, route.intent, Boolean(input.useResearch));
    await event('research_gate', research.needsResearch ? 'research required' : 'no research needed');

    // 6. Provider router.
    const strategy = buildProviderStrategy(
      route.intent,
      route.runtimePath,
      route.stakes,
      research.needsResearch,
      memoryRequests.length > 0,
    );
    const credential = await credentialPromise;
    const providerName = effectiveProviderName(credential);
    await event('provider_selected', strategy.reason, { provider: providerName, model: strategy.model });

    // 7. Specialist council (deep path only).
    let votes: SpecialistVote[] = [];
    if (route.runtimePath === 'deep_path' && strategy.specialists.length > 0) {
      votes = await runSpecialistCouncil(
        supabase, userId, runId, strategy.specialists, pack, input.command, strategy.model, credential,
      );
      for (const v of votes) {
        await repo.appendEvent(supabase, userId, runId, order++, 'specialist_vote', {
          summary: `${v.specialist}: ${v.recommendation.slice(0, 120)}`,
          status: v.status === 'invalid_output' ? 'invalid_output' : 'complete',
          payload: { specialist: v.specialist, confidence: v.confidence },
        });
      }
    }

    // 8. Final synthesis.
    const synth = await synthesizeFinal(
      supabase, userId, runId, input.command, pack, context, votes, strategy.model, route.runtimePath, credential,
    );
    const out = synth.output;
    await event('final_synthesized', out.answer.slice(0, 160), { confidence: out.confidence });

    // 9. Artifact (always saved).
    const artifact = await repo.saveArtifact(supabase, userId, runId, {
      artifactType: route.artifactType,
      title: out.answer.slice(0, 120),
      summary: out.reasoningSummary,
      contentJson: {
        answer: out.answer,
        reasoningSummary: out.reasoningSummary,
        risks: out.risks,
        opportunities: out.opportunities,
        nextActions: out.nextActions,
        specialistVotes: votes.filter((v) => v.status === 'valid'),
        researchRequests: research.requests,
        memoryRequests,
      },
      confidence: out.confidence,
      riskLevel: out.riskLevel,
    });
    if (!artifact.ok) {
      await failRun(artifact.error.message);
      return artifact;
    }

    // 10. Action drafts (only when proposed).
    const draftsResult = await repo.createActionDrafts(
      supabase, userId, runId, artifact.data.id, out.suggestedDrafts,
    );
    const drafts = draftsResult.ok ? draftsResult.data : [];
    if (drafts.length > 0) {
      await event('action_drafts_created', `${drafts.length} action draft(s)`);
    } else if (!draftsResult.ok) {
      // Don't silently drop proposed actions — record the failure in the trace.
      await repo.appendEvent(supabase, userId, runId, order++, 'error', {
        summary: `action draft creation failed: ${draftsResult.error.message}`,
        status: 'failed',
      });
    }

    // 11. Finalize.
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
      reasoningSummary: out.reasoningSummary,
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
      reasoningSummary: '',
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

/** Idempotent replay: rebuild a compact output from the stored run + artifact. */
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
  const content = (artifactRow as repo.ArtifactRow | null)?.content_json as
    | Record<string, unknown>
    | undefined;

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
    reasoningSummary: (content?.reasoningSummary as string) ?? '',
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
