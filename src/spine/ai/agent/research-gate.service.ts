/**
 * Research gate.
 *
 * Decides whether current/external facts are required. When they are and no
 * research capability is wired, the runtime returns a `research_required` state
 * with a concrete access_needed request — it never fabricates current facts.
 * Real sources are persisted to agent_sources only when actually provided.
 */
import type { AgentIntent, ResearchRequest } from './agent.types';

const CURRENT_FACTS_INTENTS = new Set<AgentIntent>([
  'stock_trading',
  'politics_regulation',
  'acquisitions',
  'credit_funding',
]);

const CURRENT_SIGNAL =
  /\b(current|today|latest|now|price|news|rate|terms|comps?|listing|market|recent|this week)\b/i;

export interface ResearchDecision {
  needsResearch: boolean;
  requests: ResearchRequest[];
}

/**
 * `useResearch` is the user's "Use research" control. Even when set, with no
 * research backend wired we still return research_required + access_needed
 * rather than guessing.
 */
export function evaluateResearchGate(
  command: string,
  intent: AgentIntent,
  useResearch: boolean,
): ResearchDecision {
  const wantsCurrent =
    useResearch || (CURRENT_FACTS_INTENTS.has(intent) && CURRENT_SIGNAL.test(command));

  if (!wantsCurrent) return { needsResearch: false, requests: [] };

  const topicByIntent: Partial<Record<AgentIntent, string>> = {
    stock_trading: 'current market prices and the trade thesis',
    politics_regulation: 'current regulatory/political developments affecting the business',
    acquisitions: 'current comparable deals and listing data',
    credit_funding: 'current lender terms and program requirements',
  };
  const topic = topicByIntent[intent] ?? 'current external facts for this question';

  return {
    needsResearch: true,
    requests: [
      {
        topic,
        reason: `This answer materially depends on ${topic}, which the agent cannot verify without live research.`,
        valueIfConnected: 'A grounded, source-backed answer instead of a dated estimate.',
        safeAlternative: 'Reason from the most recent known internal context and clearly mark it as un-verified.',
        userActionRequired: 'Connect a research/data source or provide the current figures.',
      },
    ],
  };
}
