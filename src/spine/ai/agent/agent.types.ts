/**
 * V3 Compact Reasoning Agent — type surface.
 *
 * One runtime, one endpoint, ten tables. Intermediate work is recorded as typed
 * agent_run_events; final outputs are agent_artifacts; proposed work is
 * agent_action_drafts that the user approves into Spine global_actions.
 */

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------
export type RuntimePath =
  | 'fast_path'
  | 'standard_path'
  | 'deep_path'
  | 'research_required'
  | 'memory_required'
  | 'approval_required';

export type RunStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'blocked_memory_required'
  | 'blocked_research_required'
  | 'blocked_approval_required'
  | 'failed';

export type RiskLevel = 'low' | 'medium' | 'high';

export type AgentIntent =
  | 'daily_planning'
  | 'cash'
  | 'job_hunt'
  | 'followup'
  | 'credit_funding'
  | 'projects'
  | 'acquisitions'
  | 'stock_trading'
  | 'politics_regulation'
  | 'business_strategy'
  | 'memory_update'
  | 'research'
  | 'general';

export type RunEventType =
  | 'intent_detected'
  | 'capability_plan'
  | 'permission_check'
  | 'context_built'
  | 'memory_gate'
  | 'research_gate'
  | 'problem_framed'
  | 'provider_selected'
  | 'specialist_vote'
  | 'tool_run'
  | 'source_evaluated'
  | 'final_synthesized'
  | 'action_drafts_created'
  | 'error';

export type ArtifactType =
  | 'answer'
  | 'daily_brief'
  | 'weekly_review'
  | 'recommendation'
  | 'cash_plan'
  | 'job_strategy'
  | 'credit_funding_plan'
  | 'deal_analysis'
  | 'market_analysis'
  | 'political_regulatory_brief'
  | 'business_strategy'
  | 'research_report'
  | 'decision_summary'
  | 'action_plan'
  | 'strategy_plan'
  | 'document_analysis'
  | 'spreadsheet_analysis'
  | 'vision_analysis'
  | 'camera_snapshot_analysis'
  | 'camera_analysis'
  | 'video_frame_analysis'
  | 'voice_transcript_analysis'
  | 'research_needed';

export interface AgentRunInput {
  command: string;
  modeHint?: string;
  moduleHint?: string;
  artifactTypeHint?: string;
  runtimePreference?: 'fast' | 'standard' | 'deep';
  threadId?: string | null;
  idempotency?: string | null;
  useResearch?: boolean;
  goDeeper?: boolean;
  inputArtifactIds?: string[];
}

export interface IssueBreakdownItem {
  topic: string;
  insight: string;
  tension: string;
  practicalMove: string;
}

export interface LeverageMapItem {
  lever: string;
  whyItMatters: string;
  firstProof: string;
}

export interface DecisionPathStep {
  step: string;
  reason: string;
  doneWhen: string;
}

export interface SuggestedDraft {
  title: string;
  description: string;
  category: string;
  priority: string;
  moduleId?: string | null;
  reason?: string;
  impactScore?: number;
  urgencyScore?: number;
  effortScore?: number;
  confidenceScore?: number;
}

export interface MemoryRequest {
  question: string;
  reason: string;
  memoryType: string;
}

export interface ResearchRequest {
  topic: string;
  reason: string;
  valueIfConnected: string;
  safeAlternative: string;
  userActionRequired: string;
}

export interface ProviderSummary {
  providersUsed: string[];
  fallbackUsed: boolean;
  estimatedCost?: number;
  latencyMs?: number;
}

export interface AgentRunOutput {
  runId: string;
  threadId: string;
  runtimePath: RuntimePath;
  status: RunStatus;
  intent: AgentIntent;
  artifactId: string | null;
  artifactType: ArtifactType;
  answer: string;
  jarvisBrief?: string;
  operatingMode?: string;
  realIssue?: string;
  mentorNote: string;
  issueBreakdown: IssueBreakdownItem[];
  leverageMap?: LeverageMapItem[];
  blindSpots?: string[];
  antiPatterns?: string[];
  decisionPath?: DecisionPathStep[];
  creativeAngles: string[];
  conversationStarters: string[];
  nextBestQuestion?: string;
  reasoningSummary: string;
  reasoningArtifact: ReasoningArtifact | null;
  confidence: number;
  riskLevel: RiskLevel;
  risks: string[];
  opportunities: string[];
  nextActions: Array<{ title: string; priority: string; reason: string }>;
  actionDrafts: AgentActionDraftView[];
  memoryRequests: MemoryRequest[];
  researchRequests: ResearchRequest[];
  specialistVotes: Array<{ specialist: string; recommendation: string; confidence: number }>;
  providerSummary: ProviderSummary;
}

export interface AgentActionDraftView {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  reason: string | null;
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

export interface ContextPack {
  summary: string;
  relevantFacts: Record<string, unknown>;
  openRisks: string[];
  priorities: string[];
  moduleSignals: Array<{ moduleId: string; health: string; reason: string }>;
  relevantMemory: Array<{ id: string; memoryType: string; summary: string }>;
  sourceRefs: string[];
  recordRefs: string[];
  redactionSummary: { applied: boolean; fields: string[] };
  tokenEstimate: number;
  contextHash: string;
}

export interface ProviderStrategy {
  runtimeClass: RuntimePath;
  specialists: string[];
  requiresResearch: boolean;
  requiresMemory: boolean;
  maxProviderCalls: number;
  maxLatencyMs: number;
  model: string;
  reason: string;
}

export interface SpecialistVote {
  specialist: string;
  recommendation: string;
  reasoningSummary: string;
  confidence: number;
  risks: string[];
  missingData: string[];
  status: 'valid' | 'invalid_output';
}

export interface ProblemFrame {
  domain: AgentIntent;
  objective: string;
  decisionToMake: string | null;
  constraints: string[];
  knownFacts: string[];
  unknowns: string[];
  requiredData: string[];
  stakes: RiskLevel;
  canAnswerNow: boolean;
  needsMemory: boolean;
  needsResearch: boolean;
}

export interface EvidenceItem {
  claim: string;
  source: string;
  strength: 'weak' | 'moderate' | 'strong';
}

export interface OptionAnalysis {
  option: string;
  why: string;
  risks: string[];
  nextStep: string;
}

export interface ReasoningArtifact {
  problemFrame: ProblemFrame;
  assumptions: string[];
  evidence: EvidenceItem[];
  options: OptionAnalysis[];
  risks: string[];
  recommendation: string;
  confidence: number;
  whatWouldChangeMyMind: string[];
}

export interface IntentResult {
  intent: AgentIntent;
  tags: AgentIntent[];
  stakes: RiskLevel;
  runtimePath: RuntimePath;
  artifactType: ArtifactType;
  reason: string;
}

export interface SynthesisOutput {
  answer: string;
  jarvisBrief: string;
  operatingMode: string;
  realIssue: string;
  mentorNote: string;
  issueBreakdown: IssueBreakdownItem[];
  leverageMap: LeverageMapItem[];
  blindSpots: string[];
  antiPatterns: string[];
  decisionPath: DecisionPathStep[];
  creativeAngles: string[];
  conversationStarters: string[];
  nextBestQuestion: string;
  reasoningSummary: string;
  assumptions: string[];
  evidence: EvidenceItem[];
  options: OptionAnalysis[];
  whatWouldChangeMyMind: string[];
  confidence: number;
  riskLevel: RiskLevel;
  risks: string[];
  opportunities: string[];
  nextActions: Array<{ title: string; priority: string; reason: string }>;
  suggestedDrafts: SuggestedDraft[];
}
