/**
 * Intent router — deterministic, stub-safe classification of a user command
 * into intent + stakes + runtime path + artifact type. No model call needed:
 * keyword signals + hints keep the common "What today? / Find cash fastest"
 * commands instant, and only genuinely high-stakes domains escalate to the
 * deep path.
 */
import type {
  AgentIntent,
  ArtifactType,
  IntentResult,
  RiskLevel,
  RuntimePath,
} from './agent.types';

interface IntentRule {
  intent: AgentIntent;
  stakes: RiskLevel;
  artifactType: ArtifactType;
  patterns: RegExp[];
}

// Order matters: higher-stakes / more specific rules first.
const RULES: IntentRule[] = [
  {
    intent: 'stock_trading',
    stakes: 'high',
    artifactType: 'market_analysis',
    patterns: [/\b(trade|trading|stock|option|ticker|setup|buy|sell|short|market)\b/i],
  },
  {
    intent: 'acquisitions',
    stakes: 'high',
    artifactType: 'deal_analysis',
    patterns: [/\b(deal|acqui|seller financ|real estate|comps|listing|business to buy)\b/i],
  },
  {
    intent: 'credit_funding',
    stakes: 'high',
    artifactType: 'credit_funding_plan',
    patterns: [/\b(credit|funding|fund my|loan|lender|dispute|tradeline|underwrit)\b/i],
  },
  {
    intent: 'politics_regulation',
    stakes: 'high',
    artifactType: 'political_regulatory_brief',
    patterns: [/\b(politic|regulat|policy|legislation|compliance|legal|law change)\b/i],
  },
  {
    intent: 'cash',
    stakes: 'medium',
    artifactType: 'cash_plan',
    patterns: [/\b(cash|money fast|income today|uber|gig|hit.*target|make money)\b/i],
  },
  {
    intent: 'job_hunt',
    stakes: 'medium',
    artifactType: 'job_strategy',
    patterns: [/\b(job|recruiter|application|interview|resume|career|apply)\b/i],
  },
  {
    intent: 'followup',
    stakes: 'low',
    artifactType: 'action_plan',
    patterns: [/\b(follow.?up|contact|reach out|who should i (call|message))\b/i],
  },
  {
    intent: 'projects',
    stakes: 'medium',
    artifactType: 'strategy_plan',
    patterns: [/\b(project|pause|push|build|ship)\b/i],
  },
  {
    intent: 'business_strategy',
    stakes: 'medium',
    artifactType: 'business_strategy',
    patterns: [/\b(strateg|grow|scale|empire|business plan)\b/i],
  },
  {
    intent: 'memory_update',
    stakes: 'low',
    artifactType: 'answer',
    patterns: [/\b(save (this|that) as memory|remember that|note that)\b/i],
  },
  {
    intent: 'daily_planning',
    stakes: 'low',
    artifactType: 'daily_brief',
    patterns: [/\b(today|what should i do|next (\d+ )?actions?|plan my day|priorit)\b/i],
  },
];

// Intentional deep-analysis signals only — NOT generic phrasing like "should I",
// which appears in ordinary daily commands ("what should I do today?").
const DEEP_HINT = /\b(deep|deeper|analy[sz]e|trade this|worth it|evaluate|go deep)\b/i;

function moduleHintToIntent(moduleHint?: string): AgentIntent | null {
  switch (moduleHint) {
    case 'cash-engine':
      return 'cash';
    case 'job-hunt':
      return 'job_hunt';
    case 'followup-crm':
      return 'followup';
    case 'credit-funding':
      return 'credit_funding';
    case 'projects':
      return 'projects';
    case 'acquisitions':
      return 'acquisitions';
    default:
      return null;
  }
}

const INTENT_DEFAULTS: Record<AgentIntent, { stakes: RiskLevel; artifactType: ArtifactType }> = {
  daily_planning: { stakes: 'low', artifactType: 'daily_brief' },
  cash: { stakes: 'medium', artifactType: 'cash_plan' },
  job_hunt: { stakes: 'medium', artifactType: 'job_strategy' },
  followup: { stakes: 'low', artifactType: 'action_plan' },
  credit_funding: { stakes: 'high', artifactType: 'credit_funding_plan' },
  projects: { stakes: 'medium', artifactType: 'strategy_plan' },
  acquisitions: { stakes: 'high', artifactType: 'deal_analysis' },
  stock_trading: { stakes: 'high', artifactType: 'market_analysis' },
  politics_regulation: { stakes: 'high', artifactType: 'political_regulatory_brief' },
  business_strategy: { stakes: 'medium', artifactType: 'business_strategy' },
  memory_update: { stakes: 'low', artifactType: 'answer' },
  research: { stakes: 'medium', artifactType: 'research_report' },
  general: { stakes: 'low', artifactType: 'answer' },
};

function stakesToPath(stakes: RiskLevel): RuntimePath {
  if (stakes === 'high') return 'deep_path';
  if (stakes === 'medium') return 'standard_path';
  return 'fast_path';
}

export interface RouteInput {
  command: string;
  moduleHint?: string;
  artifactTypeHint?: string;
  runtimePreference?: 'fast' | 'standard' | 'deep';
  goDeeper?: boolean;
}

export function routeIntent(input: RouteInput): IntentResult {
  const text = input.command;
  const tags: AgentIntent[] = [];

  // Collect all matching intents (multi-label), pick the first/highest-stakes.
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(text))) tags.push(rule.intent);
  }

  const hinted = moduleHintToIntent(input.moduleHint);
  if (hinted && !tags.includes(hinted)) tags.unshift(hinted);

  const primary: AgentIntent = tags[0] ?? 'general';
  const defaults = INTENT_DEFAULTS[primary];

  // Stakes can be raised by the command shape or the explicit "go deeper".
  let stakes: RiskLevel = defaults.stakes;
  if ((input.goDeeper || input.runtimePreference === 'deep' || DEEP_HINT.test(text)) && stakes === 'low') {
    stakes = 'medium';
  }

  // Runtime path: preference can force fast/deep; otherwise derive from stakes.
  let runtimePath: RuntimePath;
  if (input.goDeeper || input.runtimePreference === 'deep') {
    runtimePath = 'deep_path';
  } else if (input.runtimePreference === 'fast') {
    runtimePath = 'fast_path';
  } else {
    runtimePath = stakesToPath(stakes);
  }

  const artifactType = (input.artifactTypeHint as ArtifactType) || defaults.artifactType;

  return {
    intent: primary,
    tags,
    stakes,
    runtimePath,
    artifactType,
    reason: `intent=${primary} stakes=${stakes} path=${runtimePath}`,
  };
}
