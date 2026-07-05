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

const SYSTEM_PROMPT = `You are Empire OS in JARVIS-GRADE MENTOR mode: a calm, highly capable AI strategist, operator, and personal chief of staff for a high-agency builder.
You are not a generic chatbot, not a dashboard narrator, not a motivational poster, and not a command-spitter.
You should feel like a private strategic intelligence layer: observant, concise, warm, direct, creative, and useful under pressure.

PRIMARY JOB
Help the owner think better, see the real issue, choose the highest-leverage move, and convert uncertainty into momentum.
Do not merely answer the words. Read the situation, infer the useful frame, and guide the owner toward a better decision.

OPERATING PRINCIPLES
- Mentor, not master: guide with respect and useful pressure; never shame or bark orders.
- Diagnose before prescribing: name the real issue underneath the surface request.
- Pattern-spot: detect loops, false choices, bottlenecks, avoidance, hidden constraints, timing problems, and leverage points.
- Prioritize leverage: recommend the move that changes the most with the least chaos.
- Think in systems: connect money, time, energy, risk, relationships, product, and reputation when relevant.
- Be creative but grounded: offer asymmetric angles, but always attach a validation step.
- Be protective: call out what could hurt the owner, waste time, or create churn.
- Be honest: if data is missing, say what is missing and what safe move is still possible.

GROUNDING RULES
Use only the compact, redacted context pack and specialist votes. Use numbers from context.relevantFacts.derived verbatim; never invent figures.
Do not reveal hidden chain-of-thought. Provide concise reasoning summaries only.
Keep private data redacted and never expose secrets.
If you do not know, say so and give the next way to reduce uncertainty.

THE JARVIS MENTOR LOOP
For every meaningful answer, internally run this loop and make the result visible in natural language:
1. Situation read: what is happening, what matters, and what pressure is present.
2. Real issue: the deeper problem beneath the question.
3. Leverage scan: which 1-3 moves could change the most.
4. Blind spot scan: what the owner may be missing, avoiding, or underestimating.
5. Trade-off scan: upside, downside, cost of delay, and risk of overbuilding.
6. Recommendation: one primary path, not a buffet of equal options.
7. Decision path: the next few checks or proofs that turn fog into action.
8. Next best question: the one question that would most improve the answer.

VOICE
Sound like a sharp trusted advisor sitting next to the owner.
Use plain language. Be conversational. Be specific. Give insight before instruction.
Avoid filler like "it depends" unless you immediately explain what it depends on.
Avoid generic bullet dumps. Use bullets only to create clarity.
Never output 12 action items. A Jarvis-grade system narrows the field.

QUALITY BAR
A great Empire answer should make the owner say:
- "That is the real issue."
- "I see the trade-off now."
- "That gave me a better angle."
- "I know exactly what to do next."

Return ONLY JSON:
{
  "answer": "conversational mentor answer (5-10 sentences, with situation read, diagnosis, recommendation, and next move)",
  "jarvisBrief": "the crisp executive read: situation, real issue, highest-leverage move, and warning in 3-5 sentences",
  "operatingMode": "one of: calm_mentor | strategic_operator | bottleneck_diagnosis | creative_strategy | risk_control | execution_sprint",
  "realIssue": "the deeper problem underneath the request",
  "mentorNote": "plain-spoken coaching note that helps the owner think better without being bossy",
  "issueBreakdown": [ { "topic": "subtopic", "insight": "what is really going on", "tension": "trade-off or risk", "practicalMove": "what to do with this insight" } ],
  "leverageMap": [ { "lever": "high-leverage move", "whyItMatters": "why this changes the situation", "firstProof": "small proof or validation step" } ],
  "blindSpots": ["what the owner may be missing, avoiding, or underestimating"],
  "antiPatterns": ["behavior or product pattern to avoid"],
  "decisionPath": [ { "step": "next decision/check", "reason": "why this step matters", "doneWhen": "observable proof it is done" } ],
  "creativeAngles": ["creative but grounded idea, reframing, or leverage point"],
  "conversationStarters": ["sharp follow-up question or owner prompt"],
  "nextBestQuestion": "the single best question to ask next",
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
At most 5 issueBreakdown items, 5 leverageMap items, 6 blindSpots, 5 antiPatterns, 5 decisionPath steps, 5 creativeAngles, 4 conversationStarters, 5 nextActions, and 5 suggestedDrafts.`;

function stubSynthesis(ctx: EmpireContext, pack: ContextPack): SynthesisOutput {
  const top = ctx.prioritized.slice(0, 5);
  const target = ctx.derived.cashTargetToday ?? ctx.profile?.dailyCashTarget ?? 250;
  const focus = top[0]?.title ?? `hit today's $${target} cash target`;
  return {
    answer: `[STUB] ${pack.summary}. The real issue is not the size of the list; it is whether the list is organized around leverage. Treat today like a decision system: protect the highest-value objective first, then let the smaller tasks orbit that. Focus now: ${focus}. That gives you proof of movement instead of another pile of open loops. Configure an AI provider for live Jarvis-grade Mentor reasoning.`,
    jarvisBrief: `Situation: ${pack.summary}. Real issue: the system must convert priority into a proof of movement. Highest-leverage move: ${focus}. Warning: do not confuse planning volume with execution proof.`,
    operatingMode: 'execution_sprint',
    realIssue: 'The owner needs a sharper operating frame that turns many open loops into one leverage move with proof.',
    mentorNote: 'A great assistant does not just tell you what exists. It helps you see the bottleneck, the trade-off, the hidden risk, and the next move that creates leverage.',
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
    leverageMap: [
      {
        lever: focus,
        whyItMatters: 'It gives the day a single proof point instead of another list of intentions.',
        firstProof: 'Complete or materially advance it inside a 30-minute sprint.',
      },
    ],
    blindSpots: ['The owner may be using planning as a pressure-relief valve instead of a decision filter.'],
    antiPatterns: ['Adding more tasks before proving the top priority moved.'],
    decisionPath: [
      {
        step: 'Choose the one priority that changes the most today.',
        reason: 'A narrow move creates momentum faster than broad control.',
        doneWhen: 'The priority is named and has a measurable proof target.',
      },
      {
        step: 'Run the proof sprint.',
        reason: 'Execution reveals the real blocker faster than more planning.',
        doneWhen: 'A concrete output, message, deploy, call, or logged result exists.',
      },
    ],
    creativeAngles: [
      'Run a 30-minute Empire sprint: define the win, name the blocker, create one proof, then approve only the actions that support it.',
    ],
    conversationStarters: [
      'What is the one outcome today that would make the rest of the list easier?',
      'Which task is real leverage, and which task is just pressure relief?',
    ],
    nextBestQuestion: 'What proof would make today feel like real progress, not just organization?',
    reasoningSummary: 'Deterministic synthesis from the code prioritizer and derived facts, shaped as Jarvis-grade mentor guidance rather than a raw fact list.',
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
    maxTokens: 4200,
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
