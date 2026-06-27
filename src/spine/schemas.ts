/**
 * Zod schemas for all create/update inputs. Validation must run before any DB
 * write. Schemas mirror the DB shape in 0001_spine_backend_v3.sql.
 *
 * Convention: `createX` requires the meaningful fields; `updateX` is a partial.
 * `user_id` is never accepted from the client — it is injected server-side from
 * the authenticated session (and enforced again by RLS).
 */
import { z } from 'zod';

// Shared enums --------------------------------------------------------------
export const actionStatus = z.enum([
  'open',
  'in_progress',
  'blocked',
  'done',
  'archived',
]);
export const actionPriority = z.enum(['low', 'medium', 'high', 'critical']);
export const actionCategory = z.enum([
  'cash',
  'job',
  'followup',
  'credit',
  'project',
  'acquisition',
  'review',
  'admin',
  'general',
]);
export const decisionStatus = z.enum(['draft', 'analyzing', 'decided', 'archived']);
export const decisionType = z.enum([
  'general',
  'cash',
  'career',
  'deal',
  'risk',
  'strategic',
]);
export const advisorRole = z.enum([
  'cash_advisor',
  'career_advisor',
  'risk_advisor',
  'deal_advisor',
  'execution_advisor',
  'final_judge',
]);
export const contactType = z.enum([
  'recruiter',
  'lead',
  'partner',
  'mentor',
  'broker',
  'vendor',
  'other',
]);
export const jobStatus = z.enum([
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'accepted',
]);
export const projectStatus = z.enum(['active', 'paused', 'complete', 'archived']);
export const creditItemStatus = z.enum(['open', 'disputing', 'resolved', 'archived']);
export const acquisitionStatus = z.enum([
  'watching',
  'contacted',
  'analyzing',
  'offer',
  'closed',
  'passed',
]);
export const notificationType = z.enum(['info', 'success', 'warning', 'urgent']);
export const notificationStatus = z.enum(['unread', 'read', 'archived']);
export const trendDirection = z.enum(['up', 'down', 'flat']);

const jsonRecord = z.record(z.unknown());
const stringArray = z.array(z.string());

// Global Action -------------------------------------------------------------
export const createGlobalActionSchema = z.object({
  module_id: z.string().nullable().optional(),
  phase_id: z.string().nullable().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).nullable().optional(),
  category: actionCategory.default('general'),
  status: actionStatus.exclude(['archived']).default('open'),
  priority: actionPriority.default('medium'),
  due_at: z.string().datetime().nullable().optional(),
  impact_score: z.number().int().min(0).max(10).default(5),
  urgency_score: z.number().int().min(0).max(10).default(5),
  effort_score: z.number().int().min(0).max(10).default(5),
  confidence_score: z.number().min(0).max(1).default(0.5),
  empire_score_weight: z.number().min(0).max(5).default(1),
  source_type: z.string().default('manual'),
  source_id: z.string().nullable().optional(),
  metadata: jsonRecord.default({}),
});
export const updateGlobalActionSchema = createGlobalActionSchema.partial();

// Module Metric -------------------------------------------------------------
export const createModuleMetricSchema = z.object({
  module_id: z.string().nullable().optional(),
  metric_key: z.string().min(1).max(100),
  metric_label: z.string().min(1).max(200),
  metric_value: z.number().nullable().optional(),
  metric_text: z.string().nullable().optional(),
  target_value: z.number().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  date: z.string().date().optional(),
  trend_direction: trendDirection.nullable().optional(),
  metadata: jsonRecord.default({}),
});
export const updateModuleMetricSchema = createModuleMetricSchema.partial();

// Decision ------------------------------------------------------------------
export const createDecisionSchema = z.object({
  title: z.string().min(1).max(300),
  question: z.string().min(1).max(2000),
  context: z.string().max(20000).nullable().optional(),
  // Creation always starts in draft; only finalizeDecision can set terminal status.
  status: z.literal('draft').default('draft'),
  decision_type: decisionType.default('general'),
  metadata: jsonRecord.default({}),
});
export const updateDecisionSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  question: z.string().min(1).max(2000).optional(),
  context: z.string().max(20000).nullable().optional(),
  status: decisionStatus.optional(),
  recommendation: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  selected_option: z.string().nullable().optional(),
  risk_level: z.string().nullable().optional(),
  upside_level: z.string().nullable().optional(),
  decision_type: decisionType.optional(),
  metadata: jsonRecord.optional(),
});

// Decision Option -----------------------------------------------------------
export const createDecisionOptionSchema = z.object({
  label: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  pros: stringArray.default([]),
  cons: stringArray.default([]),
  estimated_cash_impact: z.number().nullable().optional(),
  estimated_time_hours: z.number().nullable().optional(),
  estimated_risk: z.string().nullable().optional(),
  metadata: jsonRecord.default({}),
});
export const updateDecisionOptionSchema = createDecisionOptionSchema.partial();

// Decision Vote -------------------------------------------------------------
export const createDecisionVoteSchema = z.object({
  advisor_name: z.string().min(1).max(120),
  advisor_role: advisorRole,
  model_name: z.string().nullable().optional(),
  recommendation: z.string().min(1),
  reasoning: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  risks: z.string().nullable().optional(),
  next_actions: stringArray.default([]),
  redactions_applied: z.boolean().default(true),
});
export const updateDecisionVoteSchema = createDecisionVoteSchema.partial();

// Daily Review --------------------------------------------------------------
export const createDailyReviewSchema = z.object({
  date: z.string().date().optional(),
  empire_score: z.number().nullable().optional(),
  cash_today: z.number().nullable().optional(),
  wins: z.string().nullable().optional(),
  blockers: z.string().nullable().optional(),
  top_actions: stringArray.default([]),
  mood: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: jsonRecord.default({}),
});
export const updateDailyReviewSchema = createDailyReviewSchema.partial();

// Weekly Review -------------------------------------------------------------
export const createWeeklyReviewSchema = z.object({
  week_start: z.string().date(),
  empire_score: z.number().nullable().optional(),
  cash_total: z.number().nullable().optional(),
  cash_target: z.number().nullable().optional(),
  highlights: z.string().nullable().optional(),
  lessons: z.string().nullable().optional(),
  next_week_focus: stringArray.default([]),
  notes: z.string().nullable().optional(),
  metadata: jsonRecord.default({}),
});
export const updateWeeklyReviewSchema = createWeeklyReviewSchema.partial();

// Audit Event ---------------------------------------------------------------
export const createAuditEventSchema = z.object({
  event_type: z.string().min(1).max(100),
  entity_type: z.string().min(1).max(100),
  entity_id: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  metadata: jsonRecord.default({}),
});
// Audit events are immutable; no update schema by design.

// System Event --------------------------------------------------------------
export const createSystemEventSchema = z.object({
  event_name: z.string().min(1).max(120),
  event_type: z.enum(['created', 'updated', 'completed', 'due', 'finalized', 'synced']),
  module_id: z.string().nullable().optional(),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().nullable().optional(),
  payload: jsonRecord.default({}),
});
export const updateSystemEventSchema = createSystemEventSchema.partial();

// Notification --------------------------------------------------------------
export const createNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().nullable().optional(),
  notification_type: notificationType.default('info'),
  status: notificationStatus.default('unread'),
  related_entity_type: z.string().nullable().optional(),
  related_entity_id: z.string().nullable().optional(),
  metadata: jsonRecord.default({}),
});
export const updateNotificationSchema = createNotificationSchema.partial();

// Document ------------------------------------------------------------------
export const createDocumentSchema = z.object({
  module_id: z.string().nullable().optional(),
  title: z.string().min(1).max(300),
  document_type: z.string().nullable().optional(),
  storage_path: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  sensitive: z.boolean().default(false),
  metadata: jsonRecord.default({}),
});
export const updateDocumentSchema = createDocumentSchema.partial();

// ---------------------------------------------------------------------------
// Module schemas
// ---------------------------------------------------------------------------
export const createCashEntrySchema = z.object({
  date: z.string().date().optional(),
  source: z.string().min(1).max(120),
  gross_amount: z.number().min(0).default(0),
  expenses: z.number().min(0).default(0),
  hours: z.number().min(0).nullable().optional(),
  trips: z.number().int().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const updateCashEntrySchema = createCashEntrySchema.partial();

export const createJobApplicationSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  salary_min: z.number().min(0).nullable().optional(),
  salary_max: z.number().min(0).nullable().optional(),
  status: jobStatus.default('saved'),
  priority_score: z.number().int().min(0).max(10).default(5),
  recruiter_name: z.string().nullable().optional(),
  recruiter_email: z.string().email().nullable().optional(),
  job_url: z.string().url().nullable().optional(),
  resume_version: z.string().nullable().optional(),
  next_action: z.string().nullable().optional(),
  follow_up_at: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const updateJobApplicationSchema = createJobApplicationSchema.partial();

export const createContactSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().nullable().optional(),
  contact_type: contactType,
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  status: z.enum(['active', 'cold', 'archived']).default('active'),
  last_contacted_at: z.string().datetime().nullable().optional(),
  next_follow_up_at: z.string().datetime().nullable().optional(),
  related_module_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const updateContactSchema = createContactSchema.partial();

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  status: projectStatus.default('active'),
  focus_level: z.enum(['low', 'medium', 'high']).default('medium'),
  revenue_potential: z.number().nullable().optional(),
  strategic_value: z.number().int().min(0).max(10).default(5),
  next_action: z.string().nullable().optional(),
  blocker: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const updateProjectSchema = createProjectSchema.partial();

export const createCreditItemSchema = z.object({
  bureau: z.string().nullable().optional(),
  item_name: z.string().min(1).max(200),
  item_type: z.string().nullable().optional(),
  status: creditItemStatus.default('open'),
  due_at: z.string().datetime().nullable().optional(),
  next_action: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: jsonRecord.default({}),
});
export const updateCreditItemSchema = createCreditItemSchema.partial();

export const createAcquisitionTargetSchema = z.object({
  name: z.string().min(1).max(200),
  target_type: z.string().min(1).max(120),
  location: z.string().nullable().optional(),
  asking_price: z.number().min(0).nullable().optional(),
  revenue: z.number().min(0).nullable().optional(),
  noi: z.number().nullable().optional(),
  seller_financing_possible: z.boolean().default(false),
  status: acquisitionStatus.default('watching'),
  upside_score: z.number().int().min(0).max(10).default(5),
  risk_score: z.number().int().min(0).max(10).default(5),
  next_action: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: jsonRecord.default({}),
});
export const updateAcquisitionTargetSchema = createAcquisitionTargetSchema.partial();

// Inferred input types ------------------------------------------------------
export type CreateGlobalActionInput = z.infer<typeof createGlobalActionSchema>;
export type UpdateGlobalActionInput = z.infer<typeof updateGlobalActionSchema>;
export type CreateModuleMetricInput = z.infer<typeof createModuleMetricSchema>;
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
export type CreateDecisionOptionInput = z.infer<typeof createDecisionOptionSchema>;
export type CreateDecisionVoteInput = z.infer<typeof createDecisionVoteSchema>;
export type CreateDailyReviewInput = z.infer<typeof createDailyReviewSchema>;
export type CreateWeeklyReviewInput = z.infer<typeof createWeeklyReviewSchema>;
export type CreateAuditEventInput = z.infer<typeof createAuditEventSchema>;
export type CreateSystemEventInput = z.infer<typeof createSystemEventSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type CreateCashEntryInput = z.infer<typeof createCashEntrySchema>;
export type CreateJobApplicationInput = z.infer<typeof createJobApplicationSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateCreditItemInput = z.infer<typeof createCreditItemSchema>;
export type CreateAcquisitionTargetInput = z.infer<typeof createAcquisitionTargetSchema>;
