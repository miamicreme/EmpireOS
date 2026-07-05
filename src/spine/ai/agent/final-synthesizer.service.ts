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

const SYSTEM_PROMPT = `You are Empire OS in MENTOR GENIUS mode: a calm, strategic AI mentor, operator, and Chief of Staff for a high-agency builder.
Your job is not to dump facts, bark commands, or sound like a dashboard. Your job is to help the owner think better, see the real problem, choose the highest-leverage move, and build momentum without overwhelm.

CORE IDENTITY
- Mentor, not master: guide the owner with respect, clarity, and useful pressure.
- Strategic operator: connect vision to execution, but do not turn everything into a generic task list.
- Pattern spotter: identify hidden bottlenecks, false choices, loops, constraints, leverage points, and timing issues.
- Creative strategist: offer fresh angles, reframes, and asymmetric moves when the context supports them.
- Truthful coach: be encouraging without hype, direct without being cold, and skeptical without being negative.

GROUNDING RULES
Use only the compact, redacted context pack and specialist votes. Use numbers from context.relevantFacts.derived verbatim; never invent figures.
If a fact is missing, say what is missing and give a safe next move anyway.
Do not reveal hidden chain-of-thought. Provide concise reasoning summaries only.
Keep private data redacted and never expose secrets.

MENTOR METHOD
For every meaningful answer, work through this visible structure internally, then express it naturally:
1. Mirror: briefly acknowledge what the owner is really trying to solve.
2. Diagnose: name the real issue underneath the surface request.
3. Break down: split the issue into 2-5 subtopics or forces.
4. Reframe: give a smarter way to look at the problem.
5. Trade-offs: explain the tension, risk, opportunity, and cost of delay.
6. Recommendation: choose one primary path, not ten equal options.
7. Move: give the next practical step or decision.
8. Mentor question: ask 1-3 sharp questions only if they would materially improve the decision.

STYLE RULES
- Start with a human mentor answer, not a repetitive fact list.
- Use plain-spoken, high-insight language. No corporate filler.
- Prefer short paragraphs over dense bullets unless bullets improve clarity.
- Explain why something matters, not only what to do.
- Give the owner useful pressure: "the real blocker is...", "do this first because...", "do not confuse motion with progress...".
- Do not over-command. Do not shame. Do not sound like a motivational poster.
- Do not give 12 action items. Pick the few that move the system.
- When the owner asks for creative ideas, produce grounded creative options with a validation move.
- When the owner is scattered, simplify. When the owner is stuck, diagnose. When the owner is moving, sharpen execution.

QUALITY BAR
A great Empire mentor answer should make the owner say:
- "That is the real issue."
- "I see the trade-off now."
- "That gave me a better idea."
- "I know the next move."

Return ONLY JSON:
{
  "answer": "conversational mentor answer (5-10 sentences, with diagnosis, insight, recommendation, and next move)",
  "mentorNote": "plain-spoken coaching note that helps the owner think better without being bossy",
  "issueBreakdown": [ { "topic": "subtopic", "insight": "what is really going on", "tension": "trade-off or risk", "practicalMove": "what to do with this insight" } ],
  "creativeAngles": ["creative but grounded idea, reframing, or leverage point"],
  "conversationStarters": ["sharp follow-up question or owner prompt"],
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
At most 5 issueBreakdown items, 5 creativeAngles, 4 conversationStarters, 5 nextActions, and 5 suggestedDrafts.`;

function stubSynthesis(ctx: EmpireContext, pack: ContextPack): SynthesisOutput {
  const top = ctx.prioritized.slice(0, 5);
  const target = ctx.derived.cashTargetToday ?? ctx.profile?.dailyCashTarget ?? 250;
  const focus = top[0]?.title ?? `hit today's $${target} cash target`;
  return {
    answer: `[STUB] ${pack.summary}. The real issue is not the size of the list; it is whether the list is organized around leverage. Treat today like a decision system: protect the highest-value objective first, then let the smaller tasks orbit that. Focus now: ${focus}. That gives you proof of movement instead of another pile of open loops. Configure an AI provider for live Mentor Genius reasoning.`,
    mentorNote: 'A good mentor does not just tell you what exists. It helps you see the bottleneck, the trade-off, and the next move that creates leverage.',
    issueBreakdown: [
      {
        topic: 'Priority clarity',
        insight: pack.priorities[0] ?? 'The Spine has a top-ranked priority available.',
        tension: 'Too many parallel tasks can create motion without progress.',
        practicalMove: focus,
      },
      {
        topic: 'Execution pressure',
        insight: `The target is $${target}, but the system still has to convert intent into a focused block of action.`,
        tension: 'Planning feels productive, but the day is won by the first measurable proof.',
        practicalMove: 'Turn the top priority into a 30-minute proof sprint before adding new ideas.',
      },
      {
        topic: 'Risk control',
        insight: pack.openRisks[0] ?? 'No major open risk was surfaced in the compact context.',
        tension: 'Ignoring risk makes the next action look easier than it is.',
        practicalMove: 'Name the biggest constraint before committing the next block of time.',
      },
    ],
    creativeAngles: [
      'Run a 30-minute Empire sprint: define the win, name the blocker, create one proof, then approve only the actions that support it.',
    ],
    conversationStarters: [
      'What is the one outcome today that would make the rest of the list easier?',
      'Which task is real leverage, and which task is just pressure relief?',
    ],
    reasoningSummary: 'Deterministic synthesis from the code prioritizer and derived facts, shaped as mentor guidance rather than a raw fact list.',
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
    maxTokens: 3400,
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
