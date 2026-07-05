/**
 * Core Spine types. Literal unions first, then entity row types that mirror the
 * database schema in supabase/migrations/0001_spine_backend_v3.sql.
 *
 * `any` is avoided throughout; jsonb columns are typed as `JsonValue` /
 * `Record<string, unknown>`.
 */

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// Literal unions
// ---------------------------------------------------------------------------
export type ModuleStatus = 'active' | 'inactive' | 'archived';
export type ModuleHealth = 'green' | 'yellow' | 'red';

export type ActionStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'archived';
export type ActionPriority = 'low' | 'medium' | 'high' | 'critical';
export type ActionCategory =
  | 'cash'
  | 'job'
  | 'followup'
  | 'credit'
  | 'project'
  | 'acquisition'
  | 'review'
  | 'admin'
  | 'general';

export type DecisionStatus = 'draft' | 'analyzing' | 'decided' | 'archived';
export type DecisionType =
  | 'general'
  | 'cash'
  | 'career'
  | 'deal'
  | 'risk'
  | 'strategic';

export type AdvisorRole =
  | 'cash_advisor'
  | 'career_advisor'
  | 'risk_advisor'
  | 'deal_advisor'
  | 'execution_advisor'
  | 'final_judge';

export type ContactType =
  | 'recruiter'
  | 'lead'
  | 'partner'
  | 'mentor'
  | 'broker'
  | 'vendor'
  | 'other';

export type JobStatus =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'accepted';

export type CashSource =
  | 'rideshare'
  | 'gig'
  | 'freelance'
  | 'sale'
  | 'salary'
  | 'other';

export type ProjectStatus = 'active' | 'paused' | 'complete' | 'archived';
export type CreditItemStatus = 'open' | 'disputing' | 'resolved' | 'archived';
export type AcquisitionStatus =
  | 'watching'
  | 'contacted'
  | 'analyzing'
  | 'offer'
  | 'closed'
  | 'passed';

export type EventType =
  | 'created'
  | 'updated'
  | 'completed'
  | 'due'
  | 'finalized'
  | 'synced';

export type NotificationStatus = 'unread' | 'read' | 'archived';
export type NotificationType = 'info' | 'success' | 'warning' | 'urgent';
export type RiskTolerance = 'conservative' | 'balanced' | 'aggressive';
export type PhaseStatus = 'pending' | 'active' | 'complete';
export type TrendDirection = 'up' | 'down' | 'flat';

// ---------------------------------------------------------------------------
// Entity row types
// ---------------------------------------------------------------------------
export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  current_phase: string;
  daily_cash_target: number;
  weekly_cash_target: number;
  monthly_cash_target: number;
  risk_tolerance: RiskTolerance;
  primary_goal: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface EmpirePhase {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  status: PhaseStatus;
  priority_order: number;
  progress: number;
  created_at: string;
}

export interface EmpireModule {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phase_id: string | null;
  status: ModuleStatus;
  priority: number;
  health: ModuleHealth;
  route: string;
  icon: string | null;
  capabilities: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface GlobalAction {
  id: string;
  user_id: string;
  module_id: string | null;
  phase_id: string | null;
  title: string;
  description: string | null;
  category: ActionCategory;
  status: ActionStatus;
  priority: ActionPriority;
  due_at: string | null;
  completed_at: string | null;
  impact_score: number;
  urgency_score: number;
  effort_score: number;
  confidence_score: number;
  empire_score_weight: number;
  rank_score: number | null;
  source_type: string;
  source_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ModuleMetric {
  id: string;
  user_id: string;
  module_id: string | null;
  metric_key: string;
  metric_label: string;
  metric_value: number | null;
  metric_text: string | null;
  target_value: number | null;
  unit: string | null;
  date: string;
  trend_direction: TrendDirection | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Decision {
  id: string;
  user_id: string;
  title: string;
  question: string;
  context: string | null;
  status: DecisionStatus;
  recommendation: string | null;
  confidence: number | null;
  selected_option: string | null;
  risk_level: string | null;
  upside_level: string | null;
  decision_type: DecisionType;
  created_at: string;
  decided_at: string | null;
  metadata: Record<string, unknown>;
}

export interface DecisionOption {
  id: string;
  decision_id: string;
  label: string;
  description: string | null;
  pros: JsonValue;
  cons: JsonValue;
  estimated_cash_impact: number | null;
  estimated_time_hours: number | null;
  estimated_risk: string | null;
  metadata: Record<string, unknown>;
}

export interface DecisionVote {
  id: string;
  decision_id: string;
  advisor_name: string;
  advisor_role: AdvisorRole;
  model_name: string | null;
  recommendation: string;
  reasoning: string | null;
  confidence: number | null;
  risks: string | null;
  next_actions: JsonValue;
  redactions_applied: boolean;
  created_at: string;
}

export interface DailyReview {
  id: string;
  user_id: string;
  date: string;
  empire_score: number | null;
  cash_today: number | null;
  wins: string | null;
  blockers: string | null;
  top_actions: JsonValue;
  mood: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  empire_score: number | null;
  cash_total: number | null;
  cash_target: number | null;
  highlights: string | null;
  lessons: string | null;
  next_week_focus: JsonValue;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SystemEvent {
  id: string;
  user_id: string;
  event_name: string;
  event_type: EventType;
  module_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  notification_type: NotificationType;
  status: NotificationStatus;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  module_id: string | null;
  title: string;
  document_type: string | null;
  storage_path: string | null;
  summary: string | null;
  sensitive: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Module entity row types
// ---------------------------------------------------------------------------
export interface CashEntry {
  id: string;
  user_id: string;
  date: string;
  source: string;
  gross_amount: number;
  expenses: number;
  net_amount: number;
  hours: number | null;
  trips: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  user_id: string;
  company: string;
  role: string;
  salary_min: number | null;
  salary_max: number | null;
  status: JobStatus;
  priority_score: number;
  recruiter_name: string | null;
  recruiter_email: string | null;
  job_url: string | null;
  resume_version: string | null;
  next_action: string | null;
  follow_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  contact_type: ContactType;
  phone: string | null;
  email: string | null;
  status: 'active' | 'cold' | 'archived';
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  related_module_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  status: ProjectStatus;
  focus_level: 'low' | 'medium' | 'high';
  revenue_potential: number | null;
  strategic_value: number;
  next_action: string | null;
  blocker: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditItem {
  id: string;
  user_id: string;
  bureau: string | null;
  item_name: string;
  item_type: string | null;
  status: CreditItemStatus;
  due_at: string | null;
  next_action: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AcquisitionTarget {
  id: string;
  user_id: string;
  name: string;
  target_type: string;
  location: string | null;
  asking_price: number | null;
  revenue: number | null;
  noi: number | null;
  seller_financing_possible: boolean;
  status: AcquisitionStatus;
  upside_score: number;
  risk_score: number;
  next_action: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type RecordingStatus =
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'translating'
  | 'translated'
  | 'analyzing'
  | 'ready'
  | 'failed';

export interface Recording {
  id: string;
  user_id: string;
  title: string;
  audio_storage_path: string;
  mime_type: string;
  duration_seconds: number | null;
  language: string | null;
  transcript: string | null;
  translated_transcript: string | null;
  summary: string | null;
  status: RecordingStatus;
  error: string | null;
  consent_confirmed: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Module manifest + contract supporting types
// ---------------------------------------------------------------------------
export interface ModuleManifest {
  id: string;
  name: string;
  slug: string;
  description: string;
  phaseId: string;
  route: string;
  icon?: string;
  capabilities: string[];
  priority: number;
}

export interface DecisionContext {
  moduleId: string;
  summary: string;
  facts: Record<string, unknown>;
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
}

export interface ModuleHealthResult {
  moduleId: string;
  health: ModuleHealth;
  reason: string;
}

export interface EmpireScoreResult {
  score: number;
  grade: 'red' | 'yellow' | 'green';
  breakdown: {
    cash: number;
    actions: number;
    jobHunt: number;
    followUps: number;
    review: number;
  };
}
