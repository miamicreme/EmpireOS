/**
 * Module AI Copilots.
 *
 * Each module gets a focused AI lens that reads its slice of the EmpireContext
 * and returns module-specific recommendations plus draftable actions:
 *   cash-engine     — how to hit today's number
 *   job-hunt        — rank jobs, draft follow-ups
 *   followup-crm    — who to contact next
 *   credit-funding  — next cleanup / funding move
 *   projects        — what to pause or push
 *   acquisitions    — score deals + seller-finance angles
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { aiConfig } from '@/lib/env';
import { MODULE_IDS } from '../constants';
import { buildEmpireContext } from './context/empire-context.service';
import { runStructured } from './ai-runner';
import { resolveUserCredential } from './providers/provider-config.service';
import { moduleCopilotOutputSchema } from './ai.schemas';
import { persistRecommendations } from './recommendation.service';
import { createDraftsFromSuggestions, type ActionDraft } from './action-draft.service';
import { recordUsage } from './usage.service';
import type {
  EmpireContext,
  ModuleContextSlice,
  ModuleCopilotOutput,
} from './ai.types';

type ModuleId = (typeof MODULE_IDS)[number];

const MODULE_LENS: Record<ModuleId, string> = {
  'cash-engine':
    'You are the Cash AI. Tell the operator exactly how to hit today\'s cash number: which source, how many hours/trips, what to log. Be numeric.',
  'job-hunt':
    'You are the Job Hunt AI. Rank applications by leverage, surface the next move per stage, and draft concrete follow-ups to recruiters.',
  'followup-crm':
    'You are the CRM AI. Tell the operator who to contact today and why, prioritizing relationships going cold and high-value follow-ups due.',
  'credit-funding':
    'You are the Credit/Funding AI. Recommend the next cleanup or funding move: disputes to file, utilization to fix, applications to line up.',
  projects:
    'You are the Projects AI. Decide what to pause and what to push based on revenue potential, strategic value, and blockers. Be decisive.',
  acquisitions:
    'You are the Acquisitions AI. Score deals on upside vs risk and flag seller-financing opportunities worth pursuing.',
};

function isModuleId(id: string): id is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(id);
}

function systemPrompt(moduleId: ModuleId): string {
  return `${MODULE_LENS[moduleId]}

You read a redacted slice of Empire context. Reference the real metrics. No generic advice.
ACCURACY: use numbers from context.derived verbatim; never invent figures. Start from
context.prioritized (code-ranked) and context.trends (momentum); respect context.feedback.
If the data is thin, say so and lower confidence rather than guessing.

Return JSON with this exact shape:
{
  "summary": "1-2 sentence read on this module",
  "recommendations": [
    { "recommendation": "...", "reasoning": "...", "confidence": 0.0-1.0, "riskLevel": "low|medium|high", "upsideLevel": "low|medium|high", "suggestedActions": [ { "title": "...", "description": "...", "category": "...", "priority": "..." } ] }
  ],
  "suggestedActions": [ { "title": "...", "description": "...", "category": "...", "priority": "...", "moduleId": "${moduleId}" } ]
}`;
}

function moduleSlice(ctx: EmpireContext, moduleId: ModuleId): ModuleContextSlice | undefined {
  return ctx.modules.find((m) => m.moduleId === moduleId);
}

function stubOutput(moduleId: ModuleId, slice: ModuleContextSlice | undefined): ModuleCopilotOutput {
  return {
    moduleId,
    summary: `[STUB] ${moduleId} health: ${slice?.health ?? 'unknown'}. Configure an AI provider for live analysis.`,
    recommendations: [
      {
        recommendation: `Review ${moduleId} — ${slice?.healthReason ?? 'no data'}.`,
        reasoning: 'Deterministic stub based on module health.',
        confidence: 0.5,
        riskLevel: slice?.health === 'red' ? 'high' : 'medium',
        upsideLevel: 'medium',
        suggestedActions: [],
      },
    ],
    suggestedActions: [],
  };
}

export interface ModuleCopilotResult {
  output: ModuleCopilotOutput;
  drafts: ActionDraft[];
}

export async function runModuleCopilot(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
  options: { question?: string; persist?: boolean } = {},
): Promise<AppResult<ModuleCopilotResult>> {
  if (!isModuleId(moduleId)) {
    return err(appError('validation', `Unknown module: ${moduleId}`));
  }
  const persist = options.persist ?? true;

  const ctxResult = await buildEmpireContext(supabase, userId);
  if (!ctxResult.ok) return ctxResult;
  const context = ctxResult.data;
  const slice = moduleSlice(context, moduleId);
  const credential = await resolveUserCredential(supabase, userId);

  // Scope the context to this module + shared signals to keep the call focused.
  const scopedContext = {
    generatedFor: context.generatedFor,
    profile: context.profile,
    derived: context.derived,
    module: slice,
    trends: context.trends.filter((t) => t.moduleId === moduleId),
    prioritized: context.prioritized.filter((a) => a.moduleId === moduleId),
    overdueActions: context.overdueActions.filter((a) => a.moduleId === moduleId),
    feedback: context.feedback,
  };

  const run = await runStructured({
    feature: `module_copilot:${moduleId}`,
    systemPrompt: systemPrompt(moduleId),
    instruction: options.question?.trim() || `Give the best ${moduleId} recommendations right now.`,
    context: scopedContext as unknown as Record<string, unknown>,
    schema: moduleCopilotOutputSchema,
    stub: { ...stubOutput(moduleId, slice) },
    model: aiConfig.fastModel,
    maxTokens: 1536,
    verify: true,
    credential,
  });

  const output: ModuleCopilotOutput = { ...run.data, moduleId };
  let drafts: ActionDraft[] = [];

  if (persist) {
    await recordUsage(supabase, userId, {
      feature: `module_copilot:${moduleId}`,
      provider: run.provider,
      modelName: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
    });

    if (output.recommendations.length > 0) {
      await persistRecommendations(
        supabase,
        userId,
        output.recommendations.map((r, i) => ({
          ...r,
          sourceType: `module:${moduleId}`,
          sourceId: moduleId,
          rank: i,
          modelName: run.model,
          provider: run.provider,
        })),
      );
    }

    if (output.suggestedActions.length > 0) {
      const draftResult = await createDraftsFromSuggestions(
        supabase,
        userId,
        output.suggestedActions,
        { moduleId },
      );
      if (draftResult.ok) drafts = draftResult.data;
    }
  }

  return ok({ output, drafts });
}
