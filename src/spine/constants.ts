/**
 * Spine-wide constants: phases, module ids, advisor roles, and Empire Score
 * weights. Single source of truth shared by services, seed, and docs.
 */

export const EMPIRE_PHASES = [
  'phase_0',
  'phase_1',
  'phase_2',
  'phase_3',
  'phase_4',
] as const;

export const MODULE_IDS = [
  'cash-engine',
  'finances',
  'job-hunt',
  'followup-crm',
  'credit-funding',
  'projects',
  'acquisitions',
  'recorder',
] as const;

/** Multi-advisor roles for the AI decision layer. */
export const ADVISOR_ROLES = [
  'cash_advisor',
  'career_advisor',
  'risk_advisor',
  'deal_advisor',
  'execution_advisor',
  'final_judge',
] as const;

/** Empire Score component weights (sum = 1.0). */
export const EMPIRE_SCORE_WEIGHTS = {
  cash: 0.3,
  actions: 0.25,
  jobHunt: 0.2,
  followUps: 0.15,
  review: 0.1,
} as const;

export const EMPIRE_SCORE_GRADES = {
  green: 75,
  yellow: 50,
} as const;
