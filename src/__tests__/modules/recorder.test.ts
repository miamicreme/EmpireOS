/**
 * Empire Recorder tests — schema validation + a chainable Supabase mock (no DB
 * needed), matching the pattern in modules/metrics.test.ts.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadRecordingSchema, renameRecordingSchema, MAX_AUDIO_BYTES } from '@/modules/recorder/schemas';

// ---------------------------------------------------------------------------
// Chainable Supabase mock (same shape as modules/metrics.test.ts)
// ---------------------------------------------------------------------------
function makeMock(responses: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      const rows = responses[table] ?? [];
      const chain: Record<string, unknown> = {};
      const asPromise = () => Promise.resolve({ data: rows, error: null });
      for (const method of ['select', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'not', 'order', 'limit']) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
      chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        asPromise().then(resolve, reject);
      chain.catch = (reject: (e: unknown) => unknown) => asPromise().catch(reject);
      return chain;
    },
  } as unknown as SupabaseClient;
}

const USER = 'user-test-123';

describe('uploadRecordingSchema', () => {
  it('accepts a valid upload with all fields', () => {
    const r = uploadRecordingSchema.safeParse({
      title: 'Interview with Sam',
      mimeType: 'audio/webm',
      durationSeconds: 120,
      consentConfirmed: true,
    });
    expect(r.success).toBe(true);
  });

  it('defaults the title when omitted', () => {
    const r = uploadRecordingSchema.safeParse({
      mimeType: 'audio/webm',
      consentConfirmed: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBe('Untitled recording');
  });

  it('rejects when consent is not confirmed', () => {
    const r = uploadRecordingSchema.safeParse({
      mimeType: 'audio/webm',
      consentConfirmed: false,
    });
    expect(r.success).toBe(false);
  });

  it('rejects an unsupported mime type', () => {
    const r = uploadRecordingSchema.safeParse({
      mimeType: 'video/mp4',
      consentConfirmed: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a negative duration', () => {
    const r = uploadRecordingSchema.safeParse({
      mimeType: 'audio/webm',
      consentConfirmed: true,
      durationSeconds: -5,
    });
    expect(r.success).toBe(false);
  });
});

describe('renameRecordingSchema', () => {
  it('rejects an empty title', () => {
    const r = renameRecordingSchema.safeParse({ title: '  ' });
    expect(r.success).toBe(false);
  });
  it('trims a valid title', () => {
    const r = renameRecordingSchema.safeParse({ title: '  Call with Jordan  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBe('Call with Jordan');
  });
});

describe('MAX_AUDIO_BYTES', () => {
  it('is a positive, generous limit', () => {
    expect(MAX_AUDIO_BYTES).toBeGreaterThan(10 * 1024 * 1024);
  });
});

describe('recorder getMetrics', () => {
  it('counts total/ready/pending/failed recordings', async () => {
    const { getMetrics } = await import('@/modules/recorder/metrics');
    const supabase = makeMock({
      recordings: [
        { status: 'ready' },
        { status: 'ready' },
        { status: 'transcribing' },
        { status: 'failed' },
      ],
    });
    const metrics = await getMetrics(supabase, USER);
    expect(metrics.find((m) => m.metric_key === 'recordings_total')?.metric_value).toBe(4);
    expect(metrics.find((m) => m.metric_key === 'recordings_ready')?.metric_value).toBe(2);
    expect(metrics.find((m) => m.metric_key === 'recordings_pending')?.metric_value).toBe(1);
    expect(metrics.find((m) => m.metric_key === 'recordings_failed')?.metric_value).toBe(1);
  });
});

describe('recorder getHealth', () => {
  it('is red when any recording failed', async () => {
    const { getHealth } = await import('@/modules/recorder/metrics');
    const supabase = makeMock({ recordings: [{ status: 'ready' }, { status: 'failed' }] });
    const health = await getHealth(supabase, USER);
    expect(health.health).toBe('red');
  });

  it('is yellow when a recording is still processing', async () => {
    const { getHealth } = await import('@/modules/recorder/metrics');
    const supabase = makeMock({ recordings: [{ status: 'transcribing' }] });
    const health = await getHealth(supabase, USER);
    expect(health.health).toBe('yellow');
  });

  it('is green when there are no recordings', async () => {
    const { getHealth } = await import('@/modules/recorder/metrics');
    const supabase = makeMock({ recordings: [] });
    const health = await getHealth(supabase, USER);
    expect(health.health).toBe('green');
  });

  it('is green when every recording is ready', async () => {
    const { getHealth } = await import('@/modules/recorder/metrics');
    const supabase = makeMock({ recordings: [{ status: 'ready' }, { status: 'ready' }] });
    const health = await getHealth(supabase, USER);
    expect(health.health).toBe('green');
  });
});

describe('recorder analysis — stub mode (no AI provider configured in test env)', () => {
  it('transcribeAudio returns a stub transcript without a real API call', async () => {
    const { transcribeAudio } = await import('@/spine/ai/audio');
    const result = await transcribeAudio(Buffer.from('not real audio'), 'audio/webm', 'test.webm');
    expect(result.provider).toBe('stub');
    expect(result.text).toContain('STUB');
  });

  it('analyzeRecording falls back to a deterministic stub', async () => {
    const { analyzeRecording } = await import('@/modules/recorder/analysis');
    const supabase = makeMock({ ai_providers: [] });
    const result = await analyzeRecording(supabase, USER, 'We agreed to ship by Friday and follow up with Jordan.');
    expect(result.provider).toBe('stub');
    expect(result.drafts).toEqual([]);
    expect(result.analysis.summary).toContain('STUB');
  });

  it('translateTranscript falls back to a deterministic stub', async () => {
    const { translateTranscript } = await import('@/modules/recorder/analysis');
    const supabase = makeMock({ ai_providers: [] });
    const result = await translateTranscript(supabase, USER, 'Hola, ¿cómo estás?', 'spanish');
    expect(result.provider).toBe('stub');
    expect(result.translatedText).toContain('STUB');
  });
});
