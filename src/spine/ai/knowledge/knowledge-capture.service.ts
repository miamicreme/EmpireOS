/**
 * Knowledge capture.
 *
 * Empire's context engine already reads durable memory back into every
 * surface (chat, daily brief, chief of staff) via agent_memory_items — but
 * until now nothing wrote to it except a manual "save memory" action. That
 * gap is why telling Empire something ("I didn't get the STT position")
 * never changed what it said next: the fact was spoken but never stored.
 *
 * This module closes the loop: it looks at what the operator just said or
 * uploaded, decides whether it is a durable fact worth remembering, and
 * saves it — deterministically, with no model call, so it works even in
 * stub mode.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { saveMemoryItem } from '../agent/memory-gate.service';
import { listMemoryItems } from '../agent/agent-repository.service';

export interface DurableFact {
  memoryType: string;
  title: string;
  summary: string;
  confidence: number;
}

interface FactPattern {
  memoryType: string;
  title: string;
  pattern: RegExp;
}

// Deterministic, regex-based — no model call, so capture works even when no
// AI provider is configured. Ordered most-specific first.
const CONVERSATION_FACT_PATTERNS: FactPattern[] = [
  {
    memoryType: 'job_application_outcome',
    title: 'Job application rejected',
    pattern:
      /(?:didn.?t|did not) get the [\w .&/-]{2,60}? (?:position|role|job)|was(?:n.?t| not) selected for (?:the )?[\w .&/-]{2,60}?(?:position|role)?|(?:decided to move forward with|going with|selected) (?:another|a different) candidate|application (?:for|to) [\w .&/-]{2,60}? was not successful|will not be moving forward with your (?:application|candidacy)|not (?:be )?(?:extending|offering) (?:you )?(?:an offer|the position)/i,
  },
  {
    memoryType: 'job_offer',
    title: 'Job offer received',
    pattern:
      /(?:pleased|excited|happy) to offer you|extend(?:ing)? (?:you )?an offer of employment|(?:we'?d|we would) like to offer you the [\w .&/-]{2,60}? (?:position|role)|accepted the (?:job )?offer/i,
  },
  {
    memoryType: 'job_interview',
    title: 'Interview scheduled',
    pattern: /(?:interview|call)(?: has been| is)? (?:scheduled|confirmed|set up) for/i,
  },
];

/** Detect a durable, rememberable fact in free text. Null if nothing matches. */
export function extractConversationFact(text: string): DurableFact | null {
  const trimmed = text.trim();
  if (trimmed.length < 12) return null;
  for (const { memoryType, title, pattern } of CONVERSATION_FACT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { memoryType, title, summary: trimmed.slice(0, 500), confidence: 0.75 };
    }
  }
  return null;
}

/** Significant (4+ letter) words, lowercased — punctuation-insensitive. */
function significantWords(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
}

/**
 * Two mentions of the same event ("I didn't get the STT position" said two
 * different ways) should collapse into one memory item, not one per phrasing.
 * Compares by shared significant words rather than exact text, so restating
 * the same news doesn't pile up duplicate entries.
 */
function describesSameFact(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  for (const word of wa) if (wb.has(word)) shared++;
  return shared / Math.min(wa.size, wb.size) >= 0.5;
}

async function isDuplicate(
  supabase: SupabaseClient,
  userId: string,
  fact: DurableFact,
): Promise<boolean> {
  const existing = await listMemoryItems(supabase, userId);
  if (!existing.ok) return false;
  return existing.data.some(
    (item) =>
      item.memory_type === fact.memoryType &&
      describesSameFact(item.summary ?? item.content ?? '', fact.summary),
  );
}

/**
 * Scan a conversational message for a durable fact and save it as memory.
 * Best-effort: never throws, so a capture failure can't break the turn.
 */
export async function captureConversationKnowledge(
  supabase: SupabaseClient,
  userId: string,
  message: string,
): Promise<void> {
  try {
    const fact = extractConversationFact(message);
    if (!fact) return;
    if (await isDuplicate(supabase, userId, fact)) return;
    await saveMemoryItem(supabase, userId, {
      memoryType: fact.memoryType,
      title: fact.title,
      content: fact.summary,
      summary: fact.summary,
      source: 'conversation',
      confidence: fact.confidence,
    });
  } catch {
    // Best-effort: knowledge capture must never break the conversation turn.
  }
}

export interface DocumentKnowledgeInput {
  destinationModule: string;
  title: string;
  summary: string;
  keyFacts: string[];
  confidence: number;
  source: string;
}

/**
 * Persist the facts extracted from an ingested document/email as durable
 * memory. Reuses the same fact patterns as conversation capture so a job
 * rejection pasted as a file is recognized the same way as one spoken aloud.
 */
export async function captureDocumentKnowledge(
  supabase: SupabaseClient,
  userId: string,
  input: DocumentKnowledgeInput,
): Promise<void> {
  if (input.confidence < 0.5) return;
  try {
    const content = [input.summary, ...input.keyFacts].filter(Boolean).join(' ');
    const detected = extractConversationFact(content);
    const fact: DurableFact = detected ?? {
      memoryType: `${input.destinationModule}_document`,
      title: input.title,
      summary: input.summary,
      confidence: input.confidence,
    };
    if (await isDuplicate(supabase, userId, fact)) return;
    await saveMemoryItem(supabase, userId, {
      memoryType: fact.memoryType,
      title: fact.title,
      content,
      summary: input.summary,
      source: input.source,
      confidence: input.confidence,
    });
  } catch {
    // Best-effort: knowledge capture must never break document ingestion.
  }
}
