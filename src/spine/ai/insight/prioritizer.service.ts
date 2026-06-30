/**
 * Deterministic action prioritizer.
 *
 * The Spine already ranks actions by rank_score; this layer re-weights that
 * baseline with situational leverage the raw score can't see: the current
 * empire phase, deadline pressure, today's cash gap, module health, and the
 * operator's revealed preferences (feedback). It produces a transparent
 * priorityScore + reasons so the AI (and the user) can see *why* something is
 * on top — and so the stub path ranks correctly with no model at all.
 */
import type {
  ContextAction,
  PrioritizedAction,
  DerivedFacts,
  FeedbackSignals,
  ModuleContextSlice,
} from '../ai.types';

export interface PrioritizeInputs {
  actions: ContextAction[];
  currentPhase: string | null;
  derived: DerivedFacts;
  modules: ModuleContextSlice[];
  feedback: FeedbackSignals | null;
  nowISO: string;
  today: string;
}

interface Scored {
  action: ContextAction;
  score: number;
  reasons: string[];
}

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 18,
  high: 12,
  medium: 6,
  low: 2,
};

/** Map a module's health to an attention boost (red modules need action). */
function healthBoost(slice: ModuleContextSlice | undefined): number {
  if (!slice) return 0;
  return slice.health === 'red' ? 12 : slice.health === 'yellow' ? 5 : 0;
}

function daysUntil(dueAt: string | null, nowISO: string): number | null {
  if (!dueAt) return null;
  const due = Date.parse(dueAt);
  const now = Date.parse(nowISO);
  if (Number.isNaN(due) || Number.isNaN(now)) return null;
  return Math.floor((due - now) / 86_400_000);
}

export function prioritizeActions(input: PrioritizeInputs): PrioritizedAction[] {
  const { actions, currentPhase, derived, modules, feedback, nowISO } = input;
  const moduleById = new Map(modules.map((m) => [m.moduleId, m]));

  const scored: Scored[] = actions.map((action) => {
    const reasons: string[] = [];

    // Baseline: normalized Spine rank (0..100 → 0..25).
    let score = Math.min(25, ((action.rankScore ?? 0) / 100) * 25);

    // Explicit priority field.
    const pw = PRIORITY_WEIGHT[action.priority] ?? 6;
    score += pw;
    if (action.priority === 'critical' || action.priority === 'high') {
      reasons.push(`${action.priority} priority`);
    }

    // Deadline pressure.
    const days = daysUntil(action.dueAt, nowISO);
    if (days != null) {
      if (days < 0) {
        score += 25;
        reasons.push(`overdue by ${Math.abs(days)}d`);
      } else if (days === 0) {
        score += 18;
        reasons.push('due today');
      } else if (days <= 2) {
        score += 10;
        reasons.push(`due in ${days}d`);
      } else if (days <= 7) {
        score += 4;
      }
    }

    // Phase alignment — actions tied to the active phase move the empire.
    if (currentPhase && action.phaseId && action.phaseId === currentPhase) {
      score += 8;
      reasons.push('aligned to current phase');
    }

    // Cash leverage — when there's an open cash gap today, cash actions win.
    if (action.category === 'cash' && derived.cashGapToday && derived.cashGapToday > 0) {
      score += 12;
      reasons.push(`closes today's $${derived.cashGapToday} cash gap`);
    }

    // Module health — surface actions for modules that are in the red.
    const slice = action.moduleId ? moduleById.get(action.moduleId) : undefined;
    const hb = healthBoost(slice);
    if (hb > 0) {
      score += hb;
      reasons.push(`${action.moduleId} health is ${slice?.health}`);
    }

    // Feedback — bias toward categories the operator actually acts on.
    if (feedback) {
      if (feedback.preferredCategories.includes(action.category)) {
        score += 6;
        reasons.push('matches your accepted history');
      }
      if (feedback.avoidedCategories.includes(action.category)) {
        score -= 6;
        reasons.push('you tend to skip this category');
      }
    }

    return { action, score: Math.max(0, Math.round(score)), reasons };
  });

  scored.sort((a, b) => b.score - a.score);

  // Normalize to 0..100 against the top score so the number is interpretable.
  const top = scored[0]?.score ?? 0;
  return scored.map((s) => ({
    ...s.action,
    priorityScore: top > 0 ? Math.round((s.score / top) * 100) : 0,
    priorityReasons: s.reasons,
  }));
}
