/**
 * Empire Recorder AI pipeline: translate a non-English transcript to English,
 * then extract a structured analysis (summary, key points, decisions,
 * follow-ups, questions, names, dates, risks) and draft candidate actions into
 * the Spine's approval queue. Mirrors spine/ai/intake.service.ts's shape but
 * is module-local since it only ever applies to recordings.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { aiConfig } from '@/lib/env';
import { runStructured } from '@/spine/ai/ai-runner';
import { resolveUserCredentials } from '@/spine/ai/providers/provider-config.service';
import { suggestedActionSchema } from '@/spine/ai/ai.schemas';
import { createDraftsFromSuggestions, type ActionDraft } from '@/spine/ai/action-draft.service';
import type { RecordingAnalysis } from './types';

const confidence = z.coerce.number().min(0).max(1).catch(0.5);

const translateOutputSchema = z.object({
  translatedText: z.string().default(''),
});

const analysisOutputSchema = z.object({
  summary: z.string().default(''),
  keyPoints: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  names: z.array(z.string()).default([]),
  dates: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  suggestedActions: z.array(suggestedActionSchema).default([]),
  confidence,
});

export interface TranslateResult {
  translatedText: string;
  provider: string;
}

export async function translateTranscript(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
  sourceLanguage: string | null,
): Promise<TranslateResult> {
  const credentials = await resolveUserCredentials(supabase, userId);
  const run = await runStructured({
    feature: 'recorder.translate',
    systemPrompt:
      'You are a precise translator. Translate the given transcript to natural, fluent English. ' +
      'Preserve names, dates, numbers, and technical terms exactly. Do not summarize or omit anything.',
    instruction: sourceLanguage
      ? `Translate this transcript from ${sourceLanguage} to English.`
      : 'Translate this transcript to English.',
    context: { transcript },
    schema: translateOutputSchema,
    stub: { translatedText: `[STUB] Translation unavailable — configure an AI provider. Original: ${transcript.slice(0, 200)}` },
    model: aiConfig.defaultModel,
    maxTokens: 4096,
    credentials,
  });

  return { translatedText: run.data.translatedText, provider: run.provider };
}

export interface AnalyzeResult {
  analysis: RecordingAnalysis;
  drafts: ActionDraft[];
  provider: string;
}

const SYSTEM_PROMPT = `You are the analyst for Empire Recorder, a private interview/meeting
intelligence module. You receive one conversation transcript and extract exactly what was
said — never invent facts not present in the transcript.

Return ONLY JSON:
{
  "summary": "2-4 sentences: what this conversation was about and why it matters",
  "keyPoints": ["notable point 1", ...],
  "decisions": ["decision that was made or confirmed", ...],
  "followUps": ["a follow-up that was promised or implied", ...],
  "questions": ["an open question raised but not resolved", ...],
  "names": ["person or organization name mentioned", ...],
  "dates": ["date or deadline mentioned, as stated", ...],
  "risks": ["a risk, concern, or red flag raised", ...],
  "suggestedActions": [ { "title": "...", "description": "why + how", "category": "cash|job|followup|credit|project|acquisition|general", "priority": "low|medium|high|critical" } ],
  "confidence": 0.0-1.0
}
At most 10 items per list and 5 suggestedActions. Use empty arrays when nothing applies.`;

/** Run the structured analysis pass on a transcript and draft any suggested actions. */
export async function analyzeRecording(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
): Promise<AnalyzeResult> {
  const credentials = await resolveUserCredentials(supabase, userId);
  const run = await runStructured({
    feature: 'recorder.analyze',
    systemPrompt: SYSTEM_PROMPT,
    instruction: 'Analyze this conversation transcript.',
    context: { transcript },
    schema: analysisOutputSchema,
    stub: {
      summary: `[STUB] Received a ${transcript.length}-character transcript. Configure an AI provider to summarize and extract action drafts.`,
      keyPoints: [],
      decisions: [],
      followUps: [],
      questions: [],
      names: [],
      dates: [],
      risks: [],
      suggestedActions: [],
      confidence: 0.5,
    },
    model: aiConfig.defaultModel,
    maxTokens: 2048,
    credentials,
  });

  const output = run.data;
  let drafts: ActionDraft[] = [];
  if (output.suggestedActions.length > 0) {
    const draftResult = await createDraftsFromSuggestions(supabase, userId, output.suggestedActions, {
      moduleId: 'recorder',
    });
    if (draftResult.ok) drafts = draftResult.data;
  }

  return {
    analysis: {
      summary: output.summary,
      keyPoints: output.keyPoints,
      decisions: output.decisions,
      followUps: output.followUps,
      questions: output.questions,
      names: output.names,
      dates: output.dates,
      risks: output.risks,
      confidence: output.confidence,
    },
    drafts,
    provider: run.provider,
  };
}
