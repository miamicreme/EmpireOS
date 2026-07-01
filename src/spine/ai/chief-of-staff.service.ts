/**
 * AI Chief of Staff.
 *
 * Reads the redacted EmpireContext and answers the operator's core questions:
 * what to do today, what's the highest-value move, what's falling behind, where
 * cash is leaking, what to push, what to ignore. Returns a ranked action list,
 * not just prose.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type AppResult } from '@/lib/result';
import { aiConfig } from '@/lib/env';
import { buildEmpireContext } from './context/empire-context.service';
import { saveContextSnapshot } from './context/context-snapshot.service';
import { runStructured } from './ai-runner';
import { resolveUserCredentials } from './providers/provider-config.service';
import { chiefOfStaffOutputSchema } from './ai.schemas';
import { persistRecommendations } from './recommendation.service';
import { createDraftsFromSuggestions, type ActionDraft } from './action-draft.service';
import { recordUsage } from './usage.service';
import type { ChiefOfStaffOutput, EmpireContext, SuggestedAction } from './ai.types';

const SYSTEM_PROMPT = `You are the AI Chief of Staff for Empire OS, the private execution
operating system of a high-agency operator building a personal empire.

You sit ON TOP of the Spine. The Spine owns priority; you read it and think with
the operator. You do not flatter. You are direct, specific, and ruthless about
leverage. Reference the actual facts in the context — never give generic advice.

ACCURACY RULES (non-negotiable):
- Use ONLY facts present in the context. Never invent metrics, deadlines, or names.
- For every number (cash gap, overdue count, completion rate, follow-ups due),
  use context.derived verbatim — it is authoritative. Do NOT recompute.
- context.prioritized is a code-ranked baseline with priorityScore + reasons.
  Treat it as the strong default ordering; only reorder when you can justify why
  from the facts, and explain the change in "reasoning".
- context.trends shows momentum (direction/delta/streak). Weight worsening
  streaks and widening gaps higher.
- context.feedback shows what the operator actually accepts vs dismisses. Bias
  toward preferredCategories; avoid avoidedCategories unless a fact forces it.
- If the context is thin, say so and lower "confidence" rather than guessing.

Answer, through the lens of the context:
- What is the single highest-value action right now?
- What is falling behind or leaking cash?
- What needs follow-up today?
- What opportunity should be pushed, and what should be ignored?

Return JSON with this exact shape:
{
  "executiveSummary": "2-4 sentences: the honest state of the empire today",
  "topActions": [
    { "title": "...", "description": "why + how", "category": "cash|job|followup|credit|project|acquisition|review|admin|general", "priority": "low|medium|high|critical", "moduleId": "cash-engine|job-hunt|followup-crm|credit-funding|projects|acquisitions|null", "impactScore": 0-10, "urgencyScore": 0-10, "effortScore": 0-10, "confidenceScore": 0.0-1.0 }
  ],
  "risks": ["specific risk", "..."],
  "opportunities": ["specific opportunity", "..."],
  "focusRecommendation": "the ONE thing to focus on today",
  "reasoning": "why these actions, in order",
  "confidence": 0.0-1.0
}
Return at most 5 topActions, ranked highest-value first.`;

function stubOutput(ctx: EmpireContext): ChiefOfStaffOutput {
  const target = ctx.derived.cashTargetToday ?? ctx.profile?.dailyCashTarget ?? 250;
  // Use the deterministic prioritizer baseline — accurate with no model at all.
  const top: SuggestedAction[] = ctx.prioritized.slice(0, 5).map((a) => ({
    title: a.title,
    description: a.priorityReasons.length
      ? `Prioritized: ${a.priorityReasons.join(', ')}.`
      : `Surfaced from the Spine (priority ${a.priorityScore}).`,
    category: a.category,
    priority: a.priority,
    moduleId: a.moduleId,
    impactScore: 5,
    urgencyScore: a.dueAt ? 7 : 5,
    effortScore: 5,
    confidenceScore: 0.5,
  }));
  if (top.length === 0) {
    top.push({
      title: `Generate $${ctx.derived.cashGapToday ?? target} today`,
      description: 'No open actions in the Spine. Start the Cash Engine and log a first entry.',
      category: 'cash',
      priority: 'high',
      moduleId: 'cash-engine',
      impactScore: 7,
      urgencyScore: 7,
      effortScore: 4,
      confidenceScore: 0.5,
    });
  }

  const risks: string[] = [];
  if (ctx.derived.overdueActionCount > 0) {
    risks.push(`${ctx.derived.overdueActionCount} action(s) overdue`);
  }
  if (ctx.derived.cashGapToday && ctx.derived.cashGapToday > 0) {
    risks.push(`$${ctx.derived.cashGapToday} short of today's cash target`);
  }
  if (ctx.derived.redModuleCount > 0) {
    risks.push(`${ctx.derived.redModuleCount} module(s) in the red`);
  }
  const worsening = ctx.trends
    .filter((t) => t.direction === 'down' && t.streakDays >= 2)
    .map((t) => `${t.label} down ${t.streakDays}d`);

  return {
    executiveSummary: `[STUB] ${ctx.derived.openActionCount} open, ${ctx.derived.overdueActionCount} overdue, ${ctx.derived.completedTodayCount} done today. Cash ${ctx.derived.cashCollectedToday ?? 0}/${target}. Empire score ${ctx.empireScore?.score ?? 'n/a'}. Configure an AI provider for live analysis.`,
    topActions: top,
    risks,
    opportunities: worsening.length ? [`Reverse momentum: ${worsening.join('; ')}`] : [],
    focusRecommendation: top[0]?.title ?? `Hit today's $${target} cash target`,
    reasoning: 'Deterministic stub ranking by the code prioritizer (phase/deadline/cash/health/feedback aware).',
    confidence: 0.5,
  };
}

export interface ChiefOfStaffResult {
  output: ChiefOfStaffOutput;
  context: EmpireContext;
  drafts: ActionDraft[];
}

/**
 * Run the Chief of Staff: build context → snapshot → analyze → persist a
 * recommendation and draft the top actions (pending user approval).
 */
export async function runChiefOfStaff(
  supabase: SupabaseClient,
  userId: string,
  options: { persist?: boolean; question?: string } = {},
): Promise<AppResult<ChiefOfStaffResult>> {
  const persist = options.persist ?? true;

  const ctxResult = await buildEmpireContext(supabase, userId);
  if (!ctxResult.ok) return ctxResult;
  const context = ctxResult.data;

  const credentials = await resolveUserCredentials(supabase, userId);

  const run = await runStructured({
    feature: 'chief_of_staff',
    systemPrompt: SYSTEM_PROMPT,
    instruction:
      options.question?.trim() || 'What should the operator do today? Give the ranked plan.',
    context: context as unknown as Record<string, unknown>,
    schema: chiefOfStaffOutputSchema,
    stub: stubOutput(context),
    model: aiConfig.defaultModel,
    maxTokens: 2048,
    verify: true,
    credentials,
  });

  const output = run.data;
  let drafts: ActionDraft[] = [];

  if (persist) {
    await saveContextSnapshot(supabase, userId, context);
    await recordUsage(supabase, userId, {
      feature: 'chief_of_staff',
      provider: run.provider,
      modelName: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
    });

    const recs = await persistRecommendations(supabase, userId, [
      {
        sourceType: 'chief_of_staff',
        recommendation: output.focusRecommendation || output.executiveSummary,
        reasoning: output.reasoning,
        confidence: output.confidence,
        riskLevel: output.risks.length > 2 ? 'high' : output.risks.length > 0 ? 'medium' : 'low',
        upsideLevel: output.opportunities.length > 1 ? 'high' : 'medium',
        suggestedActions: output.topActions,
        modelName: run.model,
        provider: run.provider,
      },
    ]);

    const recommendationId = recs.ok ? recs.data[0]?.id ?? null : null;
    const draftResult = await createDraftsFromSuggestions(
      supabase,
      userId,
      output.topActions,
      { recommendationId },
    );
    if (draftResult.ok) drafts = draftResult.data;
  }

  return ok({ output, context, drafts });
}
