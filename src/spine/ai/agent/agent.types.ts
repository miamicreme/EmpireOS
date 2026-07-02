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

/** Intent labels the router can assign (multi-label allowed via primary + tags). */
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

/** Event types stored in agent_run_events (replaces many would-be tables). */
export type RunEventType =
  | 'intent_detected'
  | 'capability_plan'
  | 'permission_check'
  | 'context_built'
  | 'memory_gate'
  | 'research_gate'
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
  | 'voice_transcript_analysis';

// ---------------------------------------------------------------------------
// Endpoint contract
// ---------------------------------------------------------------------------
export interface AgentRunInput {
  command: string;
  modeHint?: string;
  moduleHint?: string;
  /** Free-form hint; coerced to a known ArtifactType by the router. */
  artifactTypeHint?: string;
  /** User pressure on the router: 'fast' | 'standard' | 'deep'. */
  runtimePreference?: 'fast' | 'standard' | 'deep';
  threadId?: string | null;
  idempotency?: string | null;
  /** "Use research" control. */
  useResearch?: boolean;
  /** "Go deeper" control. */
  goDeeper?: boolean;
  /** Optional analyzed input artifact ids; still runs through POST /api/ai/agent/run. */
  inputArtifactIds?: string[];
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
  reasoningSummary: string;
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

// ---------------------------------------------------------------------------
// Context pack
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Provider routing
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Specialists
// ---------------------------------------------------------------------------
export interface SpecialistVote {
  specialist: string;
  recommendation: string;
  reasoningSummary: string;
  confidence: number;
  risks: string[];
  missingData: string[];
  status: 'valid' | 'invalid_output';
}

// ---------------------------------------------------------------------------
// Intent routing result
// ---------------------------------------------------------------------------
export interface IntentResult {
  intent: AgentIntent;
  tags: AgentIntent[];
  stakes: RiskLevel;
  runtimePath: RuntimePath;
  artifactType: ArtifactType;
  reason: string;
}

// ---------------------------------------------------------------------------
// Synthesizer output (validated from model JSON)
// ---------------------------------------------------------------------------
export interface SynthesisOutput {
  answer: string;
  reasoningSummary: string;
  confidence: number;
  riskLevel: RiskLevel;
  risks: string[];
  opportunities: string[];
  nextActions: Array<{ title: string; priority: string; reason: string }>;
  suggestedDrafts: SuggestedDraft[];
}
