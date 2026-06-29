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
