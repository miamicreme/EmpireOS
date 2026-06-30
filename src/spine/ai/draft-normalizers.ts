/**
 * Shared draft normalizers — keep AI-proposed drafts inside the Spine's enums
 * and FK constraints. One source of truth for both V2 (action-draft.service) and
 * V3 (agent action drafts) so the valid sets can't drift.
 */
import { MODULE_IDS } from '../constants';
import type { ActionCategory, ActionPriority } from '../types';

export const VALID_CATEGORIES: readonly ActionCategory[] = [
  'cash', 'job', 'followup', 'credit', 'project', 'acquisition', 'review', 'admin', 'general',
];
export const VALID_PRIORITIES: readonly ActionPriority[] = ['low', 'medium', 'high', 'critical'];

/** Coerce a module id to a known module or null (FK to public.modules). */
export function normalizeModuleId(id: string | null | undefined): string | null {
  return id && (MODULE_IDS as readonly string[]).includes(id) ? id : null;
}

export function normalizeCategory(c: string | null | undefined): ActionCategory {
  return c && (VALID_CATEGORIES as readonly string[]).includes(c) ? (c as ActionCategory) : 'general';
}

export function normalizePriority(p: string | null | undefined): ActionPriority {
  return p && (VALID_PRIORITIES as readonly string[]).includes(p) ? (p as ActionPriority) : 'medium';
}
