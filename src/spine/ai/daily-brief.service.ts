/**
 * Daily (and weekly) AI Brief.
 *
 * Generates the morning brief from the redacted EmpireContext and upserts it
 * into ai_briefs (one per user/date/type). The brief is the at-a-glance answer:
 * today's cash target, top actions, follow-ups due, job/project priority,
 * risks, opportunities, and the one recommended focus.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { todayISODate } from '@/lib/dates';
import { aiConfig } from '@/lib/env';
import { buildEmpireContext } from './context/empire-context.service';
import { runStructured } from './ai-runner';
import { dailyBriefOutputSchema } from './ai.schemas';
import { recordUsage } from './usage.service';
import { redactSensitiveText } from '../decisions/context-redaction.service';
import type { BriefType, DailyBriefOutput, EmpireContext } from './ai.types';

const TABLE = 'ai_briefs';

export interface AiBrief {
  id: string;
  user_id: string;
  date: string;
  brief_type: BriefType;
  summary: string | null;
  cash_target: number | null;
  recommended_focus: string | null;
  top_actions: unknown;
  follow_ups: unknown;
  risks: unknown;
  opportunities: unknown;
  job_hunt_priority: string | null;
  project_priority: string | null;
  confidence: number | null;
  model_name: string | null;
  provider: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function systemPrompt(briefType: BriefType): string {
  return `You are the AI Chief of Staff generating the operator's ${briefType} brief for Empire OS.
Be concise and operational. Use the real numbers in the context. No fluff.

Return JSON with this exact shape:
{
  "summary": "2-3 sentence state of play",
  "cashTarget": number | null,
  "topActions": [ { "title": "...", "description": "...", "category": "...", "priority": "...", "moduleId": "..." } ],
  "followUps": ["who/what to follow up on today"],
  "jobHuntPriority": "the single job-hunt priority",
  "projectPriority": "the single project priority",
  "risks": ["..."],
  "opportunities": ["..."],
  "recommendedFocus": "the ONE focus for the day",
  "confidence": 0.0-1.0
}
Return at most 5 topActions.`;
}

function stubBrief(ctx: EmpireContext): DailyBriefOutput {
  const target = ctx.profile?.dailyCashTarget ?? 250;
  return {
    summary: `[STUB] ${ctx.topActions.length} open actions, ${ctx.overdueActions.length} overdue. Configure an AI provider for a model-written brief.`,
    cashTarget: target,
    topActions: ctx.topActions.slice(0, 5).map((a) => ({
      title: a.title,
      description: `From the Spine (rank ${a.rankScore ?? 0}).`,
      category: a.category,
      priority: a.priority,
      moduleId: a.moduleId,
    })),
    followUps: [],
    jobHuntPriority: 'Advance the highest-priority application.',
    projectPriority: 'Push the project with the nearest deadline.',
    risks: ctx.overdueActions.length > 0 ? [`${ctx.overdueActions.length} overdue action(s)`] : [],
    opportunities: [],
    recommendedFocus: ctx.topActions[0]?.title ?? `Hit today's $${target} cash target`,
    confidence: 0.5,
  };
}

export interface DailyBriefResult {
  brief: DailyBriefOutput;
  saved: AiBrief | null;
  context: EmpireContext;
}

export async function generateDailyBrief(
  supabase: SupabaseClient,
  userId: string,
  options: { briefType?: BriefType; persist?: boolean } = {},
): Promise<AppResult<DailyBriefResult>> {
  const briefType = options.briefType ?? 'daily';
  const persist = options.persist ?? true;

  const ctxResult = await buildEmpireContext(supabase, userId);
  if (!ctxResult.ok) return ctxResult;
  const context = ctxResult.data;

  const run = await runStructured({
    feature: `${briefType}_brief`,
    systemPrompt: systemPrompt(briefType),
    instruction: `Generate the ${briefType} brief.`,
    context: context as unknown as Record<string, unknown>,
    schema: dailyBriefOutputSchema,
    stub: stubBrief(context),
    model: aiConfig.defaultModel,
    maxTokens: 1536,
  });

  const brief = run.data;
  let saved: AiBrief | null = null;

  if (persist) {
    const row = {
      user_id: userId,
      date: context.generatedFor ?? todayISODate(),
      brief_type: briefType,
      summary: brief.summary ? redactSensitiveText(brief.summary) : null,
      cash_target: brief.cashTarget,
      recommended_focus: brief.recommendedFocus ? redactSensitiveText(brief.recommendedFocus) : null,
      top_actions: brief.topActions,
      follow_ups: brief.followUps,
      risks: brief.risks,
      opportunities: brief.opportunities,
      job_hunt_priority: brief.jobHuntPriority ?? null,
      project_priority: brief.projectPriority ?? null,
      confidence: brief.confidence,
      model_name: run.model,
      provider: run.provider,
    };
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: 'user_id,date,brief_type' })
      .select('*')
      .single();
    if (error) return err(appError('db_error', error.message));
    saved = data as AiBrief;

    await recordUsage(supabase, userId, {
      feature: `${briefType}_brief`,
      provider: run.provider,
      modelName: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
    });
  }

  return ok({ brief, saved, context });
}

export async function getBrief(
  supabase: SupabaseClient,
  userId: string,
  options: { date?: string; briefType?: BriefType } = {},
): Promise<AppResult<AiBrief | null>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('date', options.date ?? todayISODate())
    .eq('brief_type', options.briefType ?? 'daily')
    .maybeSingle();
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? null) as AiBrief | null);
}

export async function listBriefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<AiBrief[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30);
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as AiBrief[]);
}
