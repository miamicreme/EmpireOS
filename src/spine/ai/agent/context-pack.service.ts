/**
 * Context pack builder.
 *
 * Reuses the V2 EmpireContext engine, then compacts it into a small, redacted,
 * pointer-based briefing for the provider — never a raw module dump. A stable
 * context_hash (over the material record signature, not the full content) lets
 * the runtime reuse a recent pack instead of rebuilding/saving churn.
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type AppResult } from '@/lib/result';
import { buildEmpireContext } from '../context/empire-context.service';
import { redactObject } from '../redaction';
import { assertNoHighRiskSecrets } from '../../decisions/context-redaction.service';
import { getActiveMemory } from './agent-repository.service';
import type { EmpireContext } from '../ai.types';
import type { ContextPack } from './agent.types';

function tokenEstimate(obj: unknown): number {
  return Math.ceil(JSON.stringify(obj).length / 4);
}

/**
 * Stable signature of the *material* state — changes only when the underlying
 * records change, so identical situations reuse the same pack.
 */
function computeContextHash(ctx: EmpireContext, memoryIds: string[], intent: string): string {
  const signature = {
    date: ctx.generatedFor,
    intent,
    phase: ctx.profile?.currentPhase ?? null,
    score: ctx.empireScore?.score ?? null,
    // ids + rank of the top actions capture "did the priorities change"
    actions: ctx.prioritized.slice(0, 8).map((a) => `${a.id}:${a.priorityScore}`),
    overdue: ctx.overdueActions.map((a) => a.id).sort(),
    moduleHealth: ctx.modules.map((m) => `${m.moduleId}:${m.health}`),
    cashGap: ctx.derived.cashGapToday,
    memory: [...memoryIds].sort(),
  };
  return createHash('sha256').update(JSON.stringify(signature)).digest('hex');
}

export interface BuiltPack {
  pack: ContextPack;
  context: EmpireContext;
}

export async function buildContextPack(
  supabase: SupabaseClient,
  userId: string,
  intent: string,
): Promise<AppResult<BuiltPack>> {
  const ctxResult = await buildEmpireContext(supabase, userId);
  if (!ctxResult.ok) return ctxResult;
  const ctx = ctxResult.data;

  const memory = await getActiveMemory(supabase, userId);
  const relevantMemory = memory.map((m) => ({
    id: m.id,
    memoryType: m.memory_type,
    summary: m.summary ?? m.content ?? '',
  }));

  const relevantFacts = redactObject({
    profile: ctx.profile,
    derived: ctx.derived,
    trends: ctx.trends,
    recentDecisions: ctx.recentDecisions,
    dailyReview: ctx.dailyReview,
    weeklyReview: ctx.weeklyReview,
  });
  // Final gate before anything is persisted or sent.
  assertNoHighRiskSecrets(JSON.stringify(relevantFacts));

  const priorities = ctx.prioritized.slice(0, 8).map((a) =>
    a.priorityReasons.length ? `${a.title} (${a.priorityReasons.join(', ')})` : a.title,
  );
  const openRisks: string[] = [];
  if (ctx.derived.overdueActionCount > 0) {
    openRisks.push(`${ctx.derived.overdueActionCount} overdue action(s)`);
  }
  if (ctx.derived.cashGapToday && ctx.derived.cashGapToday > 0) {
    openRisks.push(`$${ctx.derived.cashGapToday} short of today's cash target`);
  }
  if (ctx.derived.redModuleCount > 0) {
    openRisks.push(`${ctx.derived.redModuleCount} module(s) in the red`);
  }

  const moduleSignals = ctx.modules.map((m) => ({
    moduleId: m.moduleId,
    health: m.health,
    reason: m.healthReason,
  }));

  const recordRefs = [
    ...ctx.prioritized.slice(0, 8).map((a) => `action:${a.id}`),
    ...ctx.recentDecisions.map((d) => `decision:${d.id}`),
    ...relevantMemory.map((m) => `memory:${m.id}`),
  ];

  const pack: ContextPack = {
    summary: `Phase ${ctx.profile?.currentPhase ?? 'n/a'} · Empire score ${
      ctx.empireScore?.score ?? 'n/a'
    } · ${ctx.derived.openActionCount} open / ${ctx.derived.overdueActionCount} overdue · cash ${
      ctx.derived.cashCollectedToday ?? 0
    }/${ctx.derived.cashTargetToday ?? 0}`,
    relevantFacts,
    openRisks,
    priorities,
    moduleSignals,
    relevantMemory,
    sourceRefs: [],
    recordRefs,
    redactionSummary: { applied: true, fields: ['profile', 'facts'] },
    tokenEstimate: 0,
    contextHash: '',
  };
  pack.tokenEstimate = tokenEstimate(pack);
  pack.contextHash = computeContextHash(ctx, relevantMemory.map((m) => m.id), intent);

  return ok({ pack, context: ctx });
}
