/**
 * System and user prompts for each advisor role in the Empire OS decision panel.
 *
 * Each advisor has a focused lens and returns structured JSON so the orchestrator
 * can parse it reliably without regex fragility.
 */
import type { AdvisorRole } from '../types';
import type { DecisionContext } from '../types';
import { redactSensitiveText } from '../decisions/context-redaction.service';

export interface AdvisorPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

const BASE_SYSTEM = `You are an advisor on the Empire OS decision panel.
Your role is to give a focused, honest assessment through your specific lens.
You must return ONLY valid JSON — no prose before or after the JSON block.
Be direct and specific. Avoid generic advice. Reference the facts provided.`;

const JSON_SHAPE = `Return this exact JSON shape:
{
  "recommendation": "string — your specific recommendation (1-3 sentences)",
  "reasoning": "string — your analysis through your lens (2-4 sentences)",
  "confidence": number (0.0 to 1.0),
  "risks": "string — key risks from your perspective (1-2 sentences)",
  "next_actions": ["string", "..."] (2-4 concrete next steps)
}`;

function contextBlock(ctx: DecisionContext): string {
  return `DECISION CONTEXT:
Summary: ${ctx.summary}
Facts: ${JSON.stringify(ctx.facts, null, 2)}
Known Risks: ${ctx.risks.join('; ') || 'None identified'}
Opportunities: ${ctx.opportunities.join('; ') || 'None identified'}
Recommended Actions So Far: ${ctx.recommendedActions.join('; ') || 'None'}`;
}

const ADVISOR_SYSTEM_PROMPTS: Record<AdvisorRole, string> = {
  cash_advisor: `${BASE_SYSTEM}

YOUR LENS: Near-term cash generation (next 90 days).
Focus on: revenue impact, cash flow timing, income vs expenses, liquidity.
Ignore long-term strategy — you care about cash in hand NOW.

${JSON_SHAPE}`,

  career_advisor: `${BASE_SYSTEM}

YOUR LENS: High-income career progression and leverage.
Focus on: salary trajectory, skill leverage, network positioning, role upside.
Think in terms of income ceiling and career optionality.

${JSON_SHAPE}`,

  risk_advisor: `${BASE_SYSTEM}

YOUR LENS: Downside exposure and failure modes.
Focus on: what can go wrong, how badly, how likely, and whether it's recoverable.
Be the skeptic. Surface risks others are glossing over.

${JSON_SHAPE}`,

  deal_advisor: `${BASE_SYSTEM}

YOUR LENS: Deal structure, acquisition terms, and negotiation.
Focus on: price vs value, deal terms, seller financing, contingencies, walk-away points.
Think like an investor evaluating the structure, not the business idea.

${JSON_SHAPE}`,

  execution_advisor: `${BASE_SYSTEM}

YOUR LENS: Sequencing, execution, and next steps.
Focus on: what to do first, dependencies, bottlenecks, and time allocation.
Translate strategy into a concrete action sequence.

${JSON_SHAPE}`,

  final_judge: `${BASE_SYSTEM}

YOUR ROLE: Synthesize the advisor panel into one final recommendation.
You receive all advisor votes. Your job is to reconcile conflicts, weigh confidence,
and produce the clearest, most actionable recommendation possible.
Consider the full picture — cash, career, risk, deal, and execution angles.

${JSON_SHAPE}`,
};

export function buildAdvisorPrompt(
  role: AdvisorRole,
  question: string,
  ctx: DecisionContext,
  priorVotes?: Array<{ role: string; recommendation: string; confidence: number }>,
): AdvisorPromptResult {
  const systemPrompt = ADVISOR_SYSTEM_PROMPTS[role];

  // Redact the question independently — the context block is already redacted
  // by the orchestrator, but the question string arrives raw.
  const safeQuestion = redactSensitiveText(question);
  let userPrompt = `${contextBlock(ctx)}\n\nQUESTION: ${safeQuestion}`;

  if (priorVotes && priorVotes.length > 0 && role === 'final_judge') {
    userPrompt += '\n\nADVISOR PANEL VOTES:\n';
    for (const v of priorVotes) {
      userPrompt += `- ${v.role} (confidence ${v.confidence.toFixed(2)}): ${v.recommendation}\n`;
    }
    userPrompt += '\nSynthesize these into a final recommendation.';
  }

  return { systemPrompt, userPrompt };
}

export interface ParsedAdvisorResponse {
  recommendation: string;
  reasoning: string;
  confidence: number;
  risks: string;
  next_actions: string[];
}

/** Parse the JSON the advisor returns. Falls back gracefully on malformed output. */
export function parseAdvisorResponse(raw: string): ParsedAdvisorResponse {
  // Strip markdown code fences if the model wrapped the JSON
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<ParsedAdvisorResponse>;
    return {
      recommendation: String(parsed.recommendation ?? 'No recommendation provided.'),
      reasoning: String(parsed.reasoning ?? ''),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
      risks: String(parsed.risks ?? ''),
      next_actions: Array.isArray(parsed.next_actions)
        ? parsed.next_actions.map(String)
        : [],
    };
  } catch {
    // Model returned prose; wrap it
    return {
      recommendation: raw.slice(0, 500),
      reasoning: 'Could not parse structured response.',
      confidence: 0.4,
      risks: 'Unknown — response not structured.',
      next_actions: [],
    };
  }
}
