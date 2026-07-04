/**
 * Final synthesizer.
 *
 * Produces the single final answer (the artifact content) from the context pack
 * and any specialist votes. On the deep path it grounds the result with the
 * verify pass. Stub-safe: with no provider it synthesizes a correct, useful
 * answer directly from the deterministic prioritizer/derived facts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { runStructured } from '../ai-runner';
import { synthesisOutputSchema } from './agent.schemas';
import { logProviderRun } from './agent-repository.service';
import type { AICredential } from '../provider';
import type {
  ContextPack,
  RuntimePath,
  SpecialistVote,
  SynthesisOutput,
} from './agent.types';
import type { EmpireContext } from '../ai.types';

const SYSTEM_PROMPT = `You are the final synthesizer for an AI Chief of Staff.
You receive a compact, redacted context pack and (sometimes) specialist votes.
Reconcile them into ONE direct, specific recommendation grounded ONLY in the
provided facts. Use numbers from context.relevantFacts.derived verbatim; never
invent figures. Prefer the code-ranked priorities. Be honest about uncertainty.

Return ONLY JSON:
{
  "answer": "the direct answer (2-5 sentences)",
  "reasoningSummary": "why, in 1-3 sentences (no hidden chain-of-thought)",
  "assumptions": ["explicit assumptions, not hidden chain-of-thought"],
  "evidence": [ { "claim": "...", "source": "context_pack|specialist_vote|record_ref", "strength": "weak|moderate|strong" } ],
  "options": [ { "option": "...", "why": "...", "risks": ["..."], "nextStep": "..." } ],
  "whatWouldChangeMyMind": ["specific facts that would change the recommendation"],
  "confidence": 0..1,
  "riskLevel": "low|medium|high",
  "risks": ["..."],
  "opportunities": ["..."],
  "nextActions": [ { "title": "...", "priority": "low|medium|high|critical", "reason": "..." } ],
  "suggestedDrafts": [ { "title": "...", "description": "why + how", "category": "cash|job|followup|credit|project|acquisition|review|admin|general", "priority": "low|medium|high|critical", "moduleId": "cash-engine|job-hunt|followup-crm|credit-funding|projects|acquisitions|null", "reason": "..." } ]
}
At most 5 nextActions and 5 suggestedDrafts.`;

function stubSynthesis(ctx: EmpireContext, pack: ContextPack): SynthesisOutput {
  const top = ctx.prioritized.slice(0, 5);
  const target = ctx.derived.cashTargetToday ?? ctx.profile?.dailyCashTarget ?? 250;
  return {
    answer: `[STUB] ${pack.summary}. Focus: ${top[0]?.title ?? `hit today's $${target} cash target`}. Configure an AI provider for live reasoning.`,
    reasoningSummary: 'Deterministic synthesis from the code prioritizer and derived facts.',
    assumptions: ['The compact internal context is current enough for a bounded recommendation.'],
    evidence: [
      { claim: pack.summary, source: 'context_pack.summary', strength: 'strong' as const },
      ...pack.priorities.slice(0, 3).map((priority) => ({
        claim: priority,
        source: 'context_pack.priorities',
        strength: 'moderate' as const,
      })),
    ],
    options: top.slice(0, 3).map((a) => ({
      option: a.title,
      why: a.priorityReasons.join(', ') || `priority ${a.priorityScore}`,
      risks: pack.openRisks.slice(0, 2),
      nextStep: a.title,
    })),
    whatWouldChangeMyMind: [
      'A material change in cash collected, deadlines, module health, or user risk tolerance.',
    ],
    confidence: 0.5,
    riskLevel: ctx.derived.overdueActionCount > 0 ? 'medium' : 'low',
    risks: pack.openRisks,
    opportunities: ctx.trends
      .filter((t) => t.direction === 'down' && t.streakDays >= 2)
      .map((t) => `Reverse ${t.label} (down ${t.streakDays}d)`),
    nextActions: top.map((a) => ({
      title: a.title,
      priority: a.priority,
      reason: a.priorityReasons.join(', ') || `priority ${a.priorityScore}`,
    })),
    suggestedDrafts: top.slice(0, 3).map((a) => ({
      title: a.title,
      description: a.priorityReasons.join(', ') || `Surfaced from the Spine (priority ${a.priorityScore}).`,
      category: a.category,
      priority: a.priority,
      moduleId: a.moduleId,
      reason: a.priorityReasons[0] ?? 'High code-ranked priority.',
    })),
  };
}

export interface SynthesisResult {
  output: SynthesisOutput;
  provider: string;
  model: string;
}

export async function synthesizeFinal(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  command: string,
  pack: ContextPack,
  context: EmpireContext,
  votes: SpecialistVote[],
  model: string,
  runtimePath: RuntimePath,
  credentials: AICredential[],
): Promise<SynthesisResult> {
  const run = await runStructured({
    feature: 'final_synthesizer',
    systemPrompt: SYSTEM_PROMPT,
    instruction: command,
    context: {
      pack,
      specialistVotes: votes
        .filter((v) => v.status === 'valid')
        .map((v) => ({
          specialist: v.specialist,
          recommendation: v.recommendation,
          confidence: v.confidence,
          risks: v.risks,
        })),
    },
    schema: synthesisOutputSchema,
    stub: stubSynthesis(context, pack),
    model,
    maxTokens: 2048,
    // Ground high-stakes deep-path answers with the verify pass.
    verify: runtimePath === 'deep_path',
    credentials,
  });

  await logProviderRun(supabase, userId, runId, {
    provider: run.provider,
    model: run.model,
    runtimeClass: runtimePath,
    feature: 'final_synthesizer',
    status: run.provider === 'stub' ? 'stub' : 'success',
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
  });

  return { output: run.data, provider: run.provider, model: run.model };
}
