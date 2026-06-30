/**
 * Agent repository — the single persistence layer for the 10 compact agent_*
 * tables. Every other agent service goes through here; nothing else writes the
 * agent schema. Follows the AppResult convention and the RLS-scoped client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { nowISO } from '@/lib/dates';
import { normalizeModuleId, normalizeCategory, normalizePriority } from '../draft-normalizers';
import type {
  RuntimePath,
  RunStatus,
  RunEventType,
  ArtifactType,
  RiskLevel,
  ContextPack,
  SuggestedDraft,
} from './agent.types';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------
export interface RunRow {
  id: string;
  user_id: string;
  thread_id: string | null;
  idempotency_key: string | null;
  user_command: string;
  intent: string | null;
  runtime_path: RuntimePath;
  status: RunStatus;
  final_summary: string | null;
  confidence: number | null;
  risk_level: string | null;
  needs_memory: boolean;
  needs_research: boolean;
  needs_approval: boolean;
  cost_estimate: number | null;
  latency_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ArtifactRow {
  id: string;
  user_id: string;
  run_id: string | null;
  artifact_type: string;
  title: string | null;
  summary: string | null;
  content_json: Record<string, unknown>;
  source_refs: unknown;
  action_draft_refs: unknown;
  confidence: number | null;
  risk_level: string | null;
  status: string;
  created_at: string;
}

export interface AgentActionDraftRow {
  id: string;
  user_id: string;
  run_id: string | null;
  source_artifact_id: string | null;
  module_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  urgency: string | null;
  impact: string | null;
  due_at: string | null;
  reason: string | null;
  impact_score: number;
  urgency_score: number;
  effort_score: number;
  confidence_score: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  rejected_at: string | null;
  created_action_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ContextPackRow {
  id: string;
  user_id: string;
  run_id: string | null;
  context_hash: string;
  context_version: string;
  summary: string | null;
  token_estimate: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------
export async function upsertThread(
  supabase: SupabaseClient,
  userId: string,
  opts: { threadId?: string | null; title?: string; mode?: string } = {},
): Promise<AppResult<{ id: string }>> {
  if (opts.threadId) {
    const { data } = await supabase
      .from('agent_threads')
      .select('id')
      .eq('id', opts.threadId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return ok({ id: (data as { id: string }).id });
  }
  const { data, error } = await supabase
    .from('agent_threads')
    .insert({
      user_id: userId,
      title: opts.title ?? null,
      mode: opts.mode ?? 'general',
    })
    .select('id')
    .single();
  if (error) return err(appError('db_error', error.message));
  return ok({ id: (data as { id: string }).id });
}

// ---------------------------------------------------------------------------
// Runs (idempotent create)
// ---------------------------------------------------------------------------
export async function createRun(
  supabase: SupabaseClient,
  userId: string,
  input: {
    threadId: string;
    command: string;
    idempotencyKey?: string | null;
  },
): Promise<AppResult<{ run: RunRow; reused: boolean }>> {
  const key = input.idempotencyKey ?? null;

  const readExisting = async (): Promise<RunRow | null> => {
    if (!key) return null;
    const { data } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('user_id', userId)
      .eq('idempotency_key', key)
      .maybeSingle();
    return (data ?? null) as RunRow | null;
  };

  // Idempotency: replaying the same key returns the original run untouched.
  const existing = await readExisting();
  if (existing) return ok({ run: existing, reused: true });

  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      user_id: userId,
      thread_id: input.threadId,
      idempotency_key: key,
      user_command: input.command,
      status: 'running',
      started_at: nowISO(),
    })
    .select('*')
    .single();

  if (error) {
    // Concurrency: a simultaneous request with the same key won the insert and
    // we hit the unique(user_id, idempotency_key) constraint — replay theirs.
    const isUniqueViolation =
      (error as { code?: string }).code === '23505' || /duplicate|unique/i.test(error.message);
    if (isUniqueViolation) {
      const raced = await readExisting();
      if (raced) return ok({ run: raced, reused: true });
    }
    return err(appError('db_error', error.message));
  }
  return ok({ run: data as RunRow, reused: false });
}

export async function finalizeRun(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  patch: {
    status: RunStatus;
    intent?: string;
    runtimePath?: RuntimePath;
    finalSummary?: string;
    confidence?: number;
    riskLevel?: RiskLevel;
    needsMemory?: boolean;
    needsResearch?: boolean;
    needsApproval?: boolean;
    costEstimate?: number;
    latencyMs?: number;
    errorMessage?: string;
  },
): Promise<AppResult<RunRow>> {
  const row: Record<string, unknown> = {
    status: patch.status,
    completed_at: nowISO(),
  };
  if (patch.intent !== undefined) row.intent = patch.intent;
  if (patch.runtimePath !== undefined) row.runtime_path = patch.runtimePath;
  if (patch.finalSummary !== undefined) row.final_summary = patch.finalSummary;
  if (patch.confidence !== undefined) row.confidence = patch.confidence;
  if (patch.riskLevel !== undefined) row.risk_level = patch.riskLevel;
  if (patch.needsMemory !== undefined) row.needs_memory = patch.needsMemory;
  if (patch.needsResearch !== undefined) row.needs_research = patch.needsResearch;
  if (patch.needsApproval !== undefined) row.needs_approval = patch.needsApproval;
  if (patch.costEstimate !== undefined) row.cost_estimate = patch.costEstimate;
  if (patch.latencyMs !== undefined) row.latency_ms = patch.latencyMs;
  if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage;

  const { data, error } = await supabase
    .from('agent_runs')
    .update(row)
    .eq('id', runId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) return err(appError('db_error', error.message));
  return ok(data as RunRow);
}

/** Look up an existing run by idempotency key (for replay before any writes). */
export async function findRunByIdempotency(
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string,
): Promise<RunRow | null> {
  const { data } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  return (data ?? null) as RunRow | null;
}

export async function getRunsForThread(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
): Promise<AppResult<RunRow[]>> {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as RunRow[]);
}

// ---------------------------------------------------------------------------
// Run events (compact trace — best effort, never blocks a run)
// ---------------------------------------------------------------------------
export async function appendEvent(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  order: number,
  eventType: RunEventType,
  opts: {
    summary?: string;
    payload?: Record<string, unknown>;
    status?: 'complete' | 'in_progress' | 'failed' | 'blocked' | 'invalid_output';
    latencyMs?: number;
  } = {},
): Promise<void> {
  await supabase.from('agent_run_events').insert({
    user_id: userId,
    run_id: runId,
    event_order: order,
    event_type: eventType,
    status: opts.status ?? 'complete',
    summary: opts.summary ?? null,
    payload: opts.payload ?? {},
    latency_ms: opts.latencyMs ?? null,
  });
}

// ---------------------------------------------------------------------------
// Context packs (hash-reusable)
// ---------------------------------------------------------------------------
export async function findContextPackByHash(
  supabase: SupabaseClient,
  userId: string,
  contextHash: string,
): Promise<ContextPackRow | null> {
  const { data } = await supabase
    .from('agent_context_packs')
    .select('id, user_id, run_id, context_hash, context_version, summary, token_estimate, created_at')
    .eq('user_id', userId)
    .eq('context_hash', contextHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as ContextPackRow | null;
}

export async function saveContextPack(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  pack: ContextPack,
): Promise<AppResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('agent_context_packs')
    .insert({
      user_id: userId,
      run_id: runId,
      context_hash: pack.contextHash,
      summary: pack.summary,
      source_refs: pack.sourceRefs,
      record_refs: pack.recordRefs,
      redacted_context_json: {
        relevantFacts: pack.relevantFacts,
        openRisks: pack.openRisks,
        priorities: pack.priorities,
        moduleSignals: pack.moduleSignals,
        relevantMemory: pack.relevantMemory,
      },
      redaction_summary: pack.redactionSummary,
      token_estimate: pack.tokenEstimate,
    })
    .select('id')
    .single();
  if (error) return err(appError('db_error', error.message));
  return ok({ id: (data as { id: string }).id });
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------
export async function saveArtifact(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  input: {
    artifactType: ArtifactType;
    title: string;
    summary: string;
    contentJson: Record<string, unknown>;
    sourceRefs?: string[];
    confidence?: number;
    riskLevel?: RiskLevel;
  },
): Promise<AppResult<ArtifactRow>> {
  const { data, error } = await supabase
    .from('agent_artifacts')
    .insert({
      user_id: userId,
      run_id: runId,
      artifact_type: input.artifactType,
      title: input.title,
      summary: input.summary,
      content_json: input.contentJson,
      source_refs: input.sourceRefs ?? [],
      confidence: input.confidence ?? null,
      risk_level: input.riskLevel ?? null,
    })
    .select('*')
    .single();
  if (error) return err(appError('db_error', error.message));
  return ok(data as ArtifactRow);
}

export async function getLatestArtifactByType(
  supabase: SupabaseClient,
  userId: string,
  artifactType: ArtifactType,
): Promise<AppResult<ArtifactRow | null>> {
  const { data, error } = await supabase
    .from('agent_artifacts')
    .select('*')
    .eq('user_id', userId)
    .eq('artifact_type', artifactType)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? null) as ArtifactRow | null);
}

// ---------------------------------------------------------------------------
// Action drafts
// ---------------------------------------------------------------------------
export async function createActionDrafts(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  artifactId: string | null,
  drafts: SuggestedDraft[],
): Promise<AppResult<AgentActionDraftRow[]>> {
  if (drafts.length === 0) return ok([]);
  // Normalize to the Spine's enums + FK so a hallucinated module/category/
  // priority (or the literal "null") can't fail the batch or surface raw.
  const rows = drafts.map((d) => ({
    user_id: userId,
    run_id: runId,
    source_artifact_id: artifactId,
    module_id: normalizeModuleId(d.moduleId),
    title: d.title.slice(0, 300),
    description: d.description ? d.description.slice(0, 5000) : null,
    category: normalizeCategory(d.category),
    priority: normalizePriority(d.priority),
    reason: d.reason ?? null,
    impact_score: d.impactScore ?? 5,
    urgency_score: d.urgencyScore ?? 5,
    effort_score: d.effortScore ?? 5,
    confidence_score: d.confidenceScore ?? 0.5,
    approval_status: 'pending' as const,
  }));
  const { data, error } = await supabase.from('agent_action_drafts').insert(rows).select('*');
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as AgentActionDraftRow[]);
}

export async function getActionDraftById(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<AgentActionDraftRow>> {
  const { data, error } = await supabase
    .from('agent_action_drafts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Action draft not found.'));
  return ok(data as AgentActionDraftRow);
}

export async function getPendingDrafts(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<AgentActionDraftRow[]>> {
  const { data, error } = await supabase
    .from('agent_action_drafts')
    .select('*')
    .eq('user_id', userId)
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as AgentActionDraftRow[]);
}

// ---------------------------------------------------------------------------
// Provider runs
// ---------------------------------------------------------------------------
export async function logProviderRun(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  input: {
    provider: string;
    model: string;
    runtimeClass?: string;
    intent?: string;
    feature?: string;
    status?: 'success' | 'failed' | 'timeout' | 'fallback' | 'stub';
    latencyMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    costEstimate?: number;
    errorCode?: string;
    fallbackUsed?: boolean;
  },
): Promise<void> {
  await supabase.from('agent_provider_runs').insert({
    user_id: userId,
    run_id: runId,
    provider: input.provider,
    model: input.model,
    runtime_class: input.runtimeClass ?? null,
    intent: input.intent ?? null,
    feature: input.feature ?? null,
    status: input.status ?? 'success',
    latency_ms: input.latencyMs ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    cost_estimate: input.costEstimate ?? null,
    error_code: input.errorCode ?? null,
    fallback_used: input.fallbackUsed ?? false,
  });
}

// ---------------------------------------------------------------------------
// Sources / Memory / Feedback
// ---------------------------------------------------------------------------
export async function saveSource(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  input: Record<string, unknown>,
): Promise<void> {
  await supabase.from('agent_sources').insert({ user_id: userId, run_id: runId, ...input });
}

export async function saveMemory(
  supabase: SupabaseClient,
  userId: string,
  input: {
    memoryType: string;
    title?: string;
    content: string;
    summary?: string;
    source?: string;
    confidence?: number;
  },
): Promise<AppResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('agent_memory_items')
    .insert({
      user_id: userId,
      memory_type: input.memoryType,
      title: input.title ?? null,
      content: input.content,
      summary: input.summary ?? null,
      source: input.source ?? 'user',
      confidence: input.confidence ?? 0.8,
    })
    .select('id')
    .single();
  if (error) return err(appError('db_error', error.message));
  return ok({ id: (data as { id: string }).id });
}

export async function getActiveMemory(
  supabase: SupabaseClient,
  userId: string,
): Promise<Array<{ id: string; memory_type: string; summary: string | null; content: string | null }>> {
  const { data } = await supabase
    .from('agent_memory_items')
    .select('id, memory_type, summary, content')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as Array<{
    id: string;
    memory_type: string;
    summary: string | null;
    content: string | null;
  }>;
}

export async function saveFeedback(
  supabase: SupabaseClient,
  userId: string,
  input: Record<string, unknown>,
): Promise<AppResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('agent_feedback')
    .insert({ user_id: userId, ...input })
    .select('id')
    .single();
  if (error) return err(appError('db_error', error.message));
  return ok({ id: (data as { id: string }).id });
}
