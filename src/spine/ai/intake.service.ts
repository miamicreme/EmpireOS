/**
 * Document intake.
 *
 * One input surface: the operator pastes a document; the agent reviews it,
 * decides which module it belongs to, extracts the structured fields, and
 * proposes next actions (approval-gated drafts). The raw document is saved to
 * `documents`, tagged to the chosen module, so the decision is recorded and
 * reusable. Nothing is written into module tables automatically — the agent
 * decides *where* the data belongs and drafts the work; the operator approves.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import { ok, err, type AppResult } from '@/lib/result';
import { appError } from '@/lib/errors';
import { aiConfig } from '@/lib/env';
import { runStructured } from './ai-runner';
import { resolveUserCredentials } from './providers/provider-config.service';
import { intakeOutputSchema } from './ai.schemas';
import { createDraftsFromSuggestions, type ActionDraft } from './action-draft.service';
import type { IntakeInput } from './ai.schemas';

type IntakeOutput = z.infer<typeof intakeOutputSchema>;

const MODULE_GUIDE = `Route the document to exactly ONE destination:
- cash-engine: daily gig/Uber earnings, single receipts, one-off payments.
- finances: bank/credit-card/brokerage statements, net worth, bills, budgets, recurring subscriptions, loans.
- job-hunt: job posts, offers, applications, recruiter emails, resumes.
- followup-crm: contacts, leads, people to follow up with, networking notes.
- credit-funding: credit reports, loan/funding docs, statements, disputes.
- projects: project plans, specs, scopes, deliverables, build notes.
- acquisitions: businesses/deals to acquire, LOIs, valuations, deal terms.
- none: doesn't clearly fit any module.`;

const SYSTEM_PROMPT = `You are the intake analyst for Empire OS. You receive one
raw document and decide where it belongs and what to do with it. Be precise and
extract only facts actually present in the document — never invent values.

${MODULE_GUIDE}

Return ONLY JSON:
{
  "destinationModule": "cash-engine|finances|job-hunt|followup-crm|credit-funding|projects|acquisitions|none",
  "documentType": "short label, e.g. 'invoice', 'job posting', 'credit report'",
  "title": "a concise title for this document",
  "summary": "2-4 sentences: what this is and why it matters",
  "extractedFields": [ { "label": "field name", "value": "value from the doc" } ],
  "suggestedActions": [ { "title": "...", "description": "why + how", "category": "cash|job|followup|credit|project|acquisition|general", "priority": "low|medium|high|critical", "moduleId": "cash-engine|finances|job-hunt|followup-crm|credit-funding|projects|acquisitions|null" } ],
  "sensitive": true|false,
  "reasoning": "why this destination, in 1-2 sentences",
  "confidence": 0.0-1.0
}
Set "sensitive" true if it contains SSNs, full account numbers, or similar.
At most 8 extractedFields and 5 suggestedActions.`;

function stubOutput(input: IntakeInput): IntakeOutput {
  const firstLine = input.content.trim().split('\n')[0]?.slice(0, 80) ?? 'Document';
  return {
    destinationModule: 'none',
    documentType: 'document',
    title: input.title?.trim() || firstLine || 'Untitled document',
    summary: `[STUB] Received ${input.content.length} characters. Configure an AI provider to auto-route and extract fields.`,
    extractedFields: [],
    suggestedActions: [],
    sensitive: false,
    reasoning: 'No AI provider configured — stored without classification.',
    confidence: 0.5,
  };
}

export interface IntakeResult {
  output: IntakeOutput;
  documentId: string | null;
  drafts: ActionDraft[];
}

export async function runIntake(
  supabase: SupabaseClient,
  userId: string,
  input: IntakeInput,
): Promise<AppResult<IntakeResult>> {
  const persist = input.persist ?? true;
  const credentials = await resolveUserCredentials(supabase, userId);

  const run = await runStructured({
    feature: 'intake',
    systemPrompt: SYSTEM_PROMPT,
    instruction: input.title?.trim()
      ? `Document title hint: ${input.title.trim()}. Review the document.`
      : 'Review the document.',
    // The document body IS the context; redaction still applies in the runner.
    context: { document: input.content },
    schema: intakeOutputSchema,
    stub: stubOutput(input),
    model: aiConfig.defaultModel,
    maxTokens: 1536,
    credentials,
  });

  const output = run.data;
  const routedModule = output.destinationModule === 'none' ? null : output.destinationModule;

  if (!persist) {
    return ok({ output, documentId: null, drafts: [] });
  }

  // documents.module_id is a FK to modules(id); if the registry row isn't
  // present, tag the document with null and keep the intended module in
  // metadata rather than failing the whole intake on a FK violation.
  let moduleId: string | null = null;
  if (routedModule) {
    const { data: mod } = await supabase
      .from('modules')
      .select('id')
      .eq('id', routedModule)
      .maybeSingle();
    if (mod) moduleId = routedModule;
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      module_id: moduleId,
      title: output.title || input.title || 'Untitled document',
      document_type: output.documentType,
      summary: output.summary,
      sensitive: output.sensitive,
      metadata: {
        source: 'intake',
        routedModule,
        content: input.content,
        extractedFields: output.extractedFields,
        reasoning: output.reasoning,
        confidence: output.confidence,
        provider: run.provider,
        model: run.model,
      },
    })
    .select('id')
    .single();

  if (error) return err(appError('db_error', error.message));
  const documentId = (doc as { id: string }).id;

  // Draft the proposed actions into the approval queue, tagged to the module.
  let drafts: ActionDraft[] = [];
  if (output.suggestedActions.length > 0) {
    const draftResult = await createDraftsFromSuggestions(
      supabase,
      userId,
      output.suggestedActions,
      { moduleId },
    );
    if (draftResult.ok) drafts = draftResult.data;
  }

  return ok({ output, documentId, drafts });
}
