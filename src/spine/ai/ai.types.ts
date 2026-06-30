/**
 * AI V2 type surface.
 *
 * EmpireContext is the single object the AI Chief of Staff reads before making
 * any recommendation. It is assembled from the Spine + Modules and ALWAYS
 * redacted before it reaches an external provider.
 */
import type { ModuleHealth } from '../types';

export type RiskLevel = 'low' | 'medium' | 'high';
export type UpsideLevel = 'low' | 'medium' | 'high';
export type BriefType = 'daily' | 'weekly';
export type ActionDraftStatus = 'pending' | 'approved' | 'rejected';

/** A lightweight, redaction-friendly view of a global action. */
export interface ContextAction {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  rankScore: number | null;
  dueAt: string | null;
  moduleId: string | null;
  phaseId: string | null;
}

/**
 * An action enriched with a deterministic priority score + human-readable
 * reasons. Computed in code (phase/deadline/cash-gap/health/feedback aware) so
 * the AI starts from a correct baseline instead of re-deriving ranking.
 */
export interface PrioritizedAction extends ContextAction {
  priorityScore: number; // 0..100
  priorityReasons: string[];
}

/** Deterministically computed facts. Numbers the model must not re-derive. */
export interface DerivedFacts {
  cashTargetToday: number | null;
  cashCollectedToday: number | null;
  cashGapToday: number | null; // max(0, target - collected)
  cashTargetHitPct: number | null; // 0..1
  openActionCount: number;
  overdueActionCount: number;
  dueTodayActionCount: number;
  completedTodayCount: number;
  completionRateToday: number | null; // done / (done + open)
  followUpsDueCount: number | null;
  activeApplications: number | null;
  blockedProjects: number | null;
  openDisputes: number | null;
  redModuleCount: number;
}

/** A metric's movement over the trailing window. */
export interface MetricTrend {
  moduleId: string | null;
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'flat';
  streakDays: number; // consecutive days moving in `direction`
  samples: number;
}

/**
 * What the operator actually acts on — learned from accepted/dismissed
 * recommendations and approved/rejected drafts. Feeds the prompt so the AI
 * adapts to revealed preferences.
 */
export interface FeedbackSignals {
  acceptedCount: number;
  dismissedCount: number;
  approvedDraftCount: number;
  rejectedDraftCount: number;
  preferredCategories: string[];
  avoidedCategories: string[];
  recentAccepted: string[];
  recentDismissed: string[];
}

/** A module's contribution to the context: health + key metrics + signals. */
export interface ModuleContextSlice {
  moduleId: string;
  health: ModuleHealth;
  healthReason: string;
  metrics: Array<{
    key: string;
    label: string;
    value: number | null;
    text: string | null;
    target: number | null;
    unit: string | null;
  }>;
}

export interface ContextDecision {
  id: string;
  title: string;
  question: string;
  status: string;
  recommendation: string | null;
  confidence: number | null;
}

/**
 * The full Empire context. Built by empire-context.service, redacted before any
 * external call. Keep this JSON-serializable (it is persisted as a snapshot).
 */
export interface EmpireContext {
  generatedFor: string; // ISO date
  profile: {
    fullName: string | null;
    currentPhase: string;
    dailyCashTarget: number;
    weeklyCashTarget: number;
    monthlyCashTarget: number;
    riskTolerance: string;
    primaryGoal: string;
  } | null;
  empireScore: {
    score: number;
    grade: 'red' | 'yellow' | 'green';
  } | null;
  topActions: ContextAction[];
  overdueActions: ContextAction[];
  modules: ModuleContextSlice[];
  recentDecisions: ContextDecision[];
  dailyReview: {
    date: string;
    empireScore: number | null;
    cashToday: number | null;
    wins: string | null;
    blockers: string | null;
  } | null;
  weeklyReview: {
    weekStart: string;
    cashTotal: number | null;
    cashTarget: number | null;
    highlights: string | null;
  } | null;
  /** Deterministic, authoritative numbers — the model must use these as-is. */
  derived: DerivedFacts;
  /** Momentum signals over the trailing window. */
  trends: MetricTrend[];
  /** Code-ranked action baseline (phase/deadline/cash/health/feedback aware). */
  prioritized: PrioritizedAction[];
  /** Revealed preferences learned from prior accept/dismiss/approve/reject. */
  feedback: FeedbackSignals | null;
}

// ---------------------------------------------------------------------------
// AI output shapes (parsed from model JSON, then persisted)
// ---------------------------------------------------------------------------
export interface SuggestedAction {
  title: string;
  description: string;
  category: string;
  priority: string;
  moduleId?: string | null;
  impactScore?: number;
  urgencyScore?: number;
  effortScore?: number;
  confidenceScore?: number;
}

export interface ChiefOfStaffOutput {
  executiveSummary: string;
  topActions: SuggestedAction[];
  risks: string[];
  opportunities: string[];
  focusRecommendation: string;
  reasoning: string;
  confidence: number;
}

export interface DailyBriefOutput {
  summary: string;
  cashTarget: number | null;
  topActions: SuggestedAction[];
  followUps: string[];
  jobHuntPriority: string;
  projectPriority: string;
  risks: string[];
  opportunities: string[];
  recommendedFocus: string;
  confidence: number;
}

export interface RecommendationOutput {
  recommendation: string;
  reasoning: string;
  confidence: number;
  riskLevel: RiskLevel;
  upsideLevel: UpsideLevel;
  suggestedActions: SuggestedAction[];
}

export interface ModuleCopilotOutput {
  moduleId: string;
  summary: string;
  recommendations: RecommendationOutput[];
  suggestedActions: SuggestedAction[];
}
