/**
 * Builds the visible reasoning artifact for medium/high-stakes runs.
 *
 * This is not chain-of-thought. It is a compact audit surface: the frame,
 * assumptions, evidence, options, risks, and what would change the answer.
 */
import type { EmpireContext } from '../ai.types';
import type {
  AgentIntent,
  ContextPack,
  MemoryRequest,
  ProblemFrame,
  ReasoningArtifact,
  ResearchRequest,
  RiskLevel,
  SpecialistVote,
  SynthesisOutput,
} from './agent.types';

const DOMAIN_LABEL: Record<AgentIntent, string> = {
  daily_planning: 'daily planning',
  cash: 'cash execution',
  job_hunt: 'job/income strategy',
  followup: 'follow-up prioritization',
  credit_funding: 'credit/funding',
  projects: 'project execution',
  acquisitions: 'acquisition/deal analysis',
  stock_trading: 'market/trading analysis',
  politics_regulation: 'political/regulatory analysis',
  business_strategy: 'business strategy',
  memory_update: 'memory update',
  research: 'research',
  general: 'general',
};

function firstSentence(text: string): string {
  return text.split(/[.!?]\s/)[0]?.trim() || text.trim();
}

function compactList(items: string[], fallback: string, max = 5): string[] {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  return (cleaned.length ? cleaned : [fallback]).slice(0, max);
}

export interface BuildReasoningArtifactInput {
  command: string;
  intent: AgentIntent;
  stakes: RiskLevel;
  pack: ContextPack;
  context: EmpireContext;
  memoryRequests: MemoryRequest[];
  researchRequests: ResearchRequest[];
  votes: SpecialistVote[];
  output: SynthesisOutput;
}

export function buildReasoningArtifact(input: BuildReasoningArtifactInput): ReasoningArtifact {
  const validVotes = input.votes.filter((vote) => vote.status === 'valid');
  const needsMemory = input.memoryRequests.length > 0;
  const needsResearch = input.researchRequests.length > 0;
  const topPriorities = input.pack.priorities.slice(0, 5);
  const knownFacts = compactList(
    [
      input.pack.summary,
      ...topPriorities.map((priority) => `Priority signal: ${priority}`),
      ...input.pack.moduleSignals.slice(0, 3).map((m) => `${m.moduleId} health is ${m.health}: ${m.reason}`),
    ],
    'Only compact internal context is available.',
    8,
  );

  const unknowns = compactList(
    [
      ...input.memoryRequests.map((request) => request.question),
      ...input.researchRequests.map((request) => request.topic),
      ...validVotes.flatMap((vote) => vote.missingData),
    ],
    'No major missing inputs were identified from the available context.',
    8,
  );

  const requiredData = compactList(
    [
      ...input.memoryRequests.map((request) => request.memoryType),
      ...input.researchRequests.map((request) => request.topic),
      ...input.pack.sourceRefs,
    ],
    'No additional data is required for a bounded recommendation.',
    8,
  );

  const problemFrame: ProblemFrame = {
    domain: input.intent,
    objective: firstSentence(input.command),
    decisionToMake: `${DOMAIN_LABEL[input.intent]} recommendation`,
    constraints: [
      'Use only available internal context unless research is explicitly connected.',
      'External, financial, destructive, or irreversible actions must remain approval-gated.',
      'Do not expose hidden chain-of-thought.',
    ],
    knownFacts,
    unknowns,
    requiredData,
    stakes: input.stakes,
    canAnswerNow: !needsMemory && !needsResearch,
    needsMemory,
    needsResearch,
  };

  const evidence = input.output.evidence.length
    ? input.output.evidence
    : [
        {
          claim: input.pack.summary,
          source: 'context_pack.summary',
          strength: 'strong' as const,
        },
        ...topPriorities.slice(0, 3).map((priority) => ({
          claim: priority,
          source: 'context_pack.priorities',
          strength: 'moderate' as const,
        })),
      ];

  const assumptions = compactList(
    input.output.assumptions,
    needsResearch
      ? 'The answer is provisional until current external facts are supplied.'
      : 'The compact internal context reflects the current operating state.',
  );

  const options = input.output.options.length
    ? input.output.options.slice(0, 5)
    : input.output.nextActions.slice(0, 3).map((action) => ({
        option: action.title,
        why: action.reason,
        risks: input.output.risks.slice(0, 2),
        nextStep: action.title,
      }));

  const whatWouldChangeMyMind = compactList(
    [
      ...input.output.whatWouldChangeMyMind,
      ...input.researchRequests.map((request) => `Verified research changes the facts for: ${request.topic}`),
      ...input.memoryRequests.map((request) => `User memory answer changes the decision: ${request.question}`),
      ...validVotes.flatMap((vote) => vote.missingData.map((item) => `${vote.specialist} missing data: ${item}`)),
    ],
    'A material change in cash, risk tolerance, deadlines, or module health would change the recommendation.',
  );

  return {
    problemFrame,
    assumptions,
    evidence: evidence.slice(0, 8),
    options,
    risks: input.output.risks.slice(0, 8),
    recommendation: input.output.answer,
    confidence: input.output.confidence,
    whatWouldChangeMyMind,
  };
}
