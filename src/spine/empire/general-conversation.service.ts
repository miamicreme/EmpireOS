import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { runAgent } from '@/spine/ai/agent/agent-orchestrator.service';
import { createEmpireRun, updateEmpireRun } from './empire-run.repository';
import { decideEmpireDelegation, type EmpireConductorDecision } from './conductor-agent.service';

export interface EmpireConversationResult {
  runId: string;
  traceId: string;
  status: 'completed' | 'needs_input' | 'failed';
  intent: 'general_conversation';
  message: string;
  operations: [];
  data: {
    agentRunId: string;
    threadId: string;
    confidence: number;
    riskLevel: string;
    runtimePath: string;
    providerSummary: unknown;
    nextBestQuestion?: string;
    conductor: {
      provider: string;
      model: string;
      decision: EmpireConductorDecision;
    };
    specialistAgents: string[];
  };
  nextBestQuestion?: string;
}

export async function runEmpireGeneralConversation(
  supabase: SupabaseClient,
  userId: string,
  input: { message: string; conversationId?: string },
): Promise<AppResult<EmpireConversationResult>> {
  const message = input.message.trim();
  if (!message) return err(appError('validation', 'Empire needs a message.'));

  const runId = randomUUID();
  const traceId = randomUUID();
  const created = await createEmpireRun(supabase, {
    id: runId,
    userId,
    traceId,
    conversationId: input.conversationId,
    status: 'understanding',
    intent: 'general_conversation',
    requestSummary: 'Owner requested conversational intelligence through Empire Conductor.',
  });
  if (!created.ok) return created;

  const planning = await updateEmpireRun(supabase, userId, runId, { status: 'planning' });
  if (!planning.ok) return planning;

  const conductor = await decideEmpireDelegation(supabase, userId, message);
  const decision = conductor.decision;

  const agent = await runAgent(supabase, userId, {
    command: message,
    modeHint: decision.responseMode === 'delegated' ? 'empire_orchestrated' : 'empire_conversation',
    moduleHint: decision.moduleHint ?? undefined,
    runtimePreference: decision.runtimePreference,
    threadId: input.conversationId ?? undefined,
    idempotency: `empire:${runId}`,
    useResearch: decision.useResearch,
    goDeeper: decision.goDeeper || decision.responseMode === 'delegated',
  });

  if (!agent.ok) {
    await updateEmpireRun(supabase, userId, runId, {
      status: 'failed',
      response_message: 'Empire could not complete the conversation.',
      completed_at: new Date().toISOString(),
      error_code: agent.error.code,
      error_message: agent.error.message.slice(0, 1000),
      safe_result: {
        conductorProvider: conductor.provider,
        conductorModel: conductor.model,
        conductorDecision: decision,
      },
    });
    return agent;
  }

  const answer = agent.data.answer.trim() || agent.data.mentorNote.trim();
  const specialistAgents = agent.data.specialistVotes.map((vote) => vote.specialist);
  const conductorData = {
    provider: conductor.provider,
    model: conductor.model,
    decision,
  };

  if (!answer) {
    const fallback = 'I understood the request, but the AI provider returned no usable answer.';
    await updateEmpireRun(supabase, userId, runId, {
      status: 'needs_input',
      response_message: fallback,
      next_best_question: agent.data.nextBestQuestion ?? 'Could you restate the outcome you need?',
      completed_at: new Date().toISOString(),
      safe_result: {
        agentRunId: agent.data.runId,
        emptyAnswer: true,
        conductorProvider: conductor.provider,
        conductorModel: conductor.model,
        conductorDecision: decision,
        specialistAgents,
      },
    });
    return ok({
      runId,
      traceId,
      status: 'needs_input',
      intent: 'general_conversation',
      message: fallback,
      operations: [],
      nextBestQuestion: agent.data.nextBestQuestion,
      data: {
        agentRunId: agent.data.runId,
        threadId: agent.data.threadId,
        confidence: agent.data.confidence,
        riskLevel: agent.data.riskLevel,
        runtimePath: agent.data.runtimePath,
        providerSummary: agent.data.providerSummary,
        nextBestQuestion: agent.data.nextBestQuestion,
        conductor: conductorData,
        specialistAgents,
      },
    });
  }

  const completedAt = new Date().toISOString();
  const updated = await updateEmpireRun(supabase, userId, runId, {
    status: 'completed',
    response_message: answer.slice(0, 8000),
    next_best_question: agent.data.nextBestQuestion ?? null,
    completed_at: completedAt,
    safe_result: {
      agentRunId: agent.data.runId,
      agentThreadId: agent.data.threadId,
      confidence: agent.data.confidence,
      riskLevel: agent.data.riskLevel,
      runtimePath: agent.data.runtimePath,
      providersUsed: agent.data.providerSummary.providersUsed,
      fallbackUsed: agent.data.providerSummary.fallbackUsed,
      actionDraftCount: agent.data.actionDrafts.length,
      conductorProvider: conductor.provider,
      conductorModel: conductor.model,
      conductorDecision: decision,
      specialistAgents,
    },
  });
  if (!updated.ok) return updated;

  return ok({
    runId,
    traceId,
    status: 'completed',
    intent: 'general_conversation',
    message: answer,
    operations: [],
    nextBestQuestion: agent.data.nextBestQuestion,
    data: {
      agentRunId: agent.data.runId,
      threadId: agent.data.threadId,
      confidence: agent.data.confidence,
      riskLevel: agent.data.riskLevel,
      runtimePath: agent.data.runtimePath,
      providerSummary: agent.data.providerSummary,
      nextBestQuestion: agent.data.nextBestQuestion,
      conductor: conductorData,
      specialistAgents,
    },
  });
}
