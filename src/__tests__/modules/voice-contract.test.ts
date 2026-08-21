import { describe, expect, it } from 'vitest';
import { manifest } from '@/modules/voice/manifest';
import {
  createVoiceSessionSchema,
  submitVoiceUtteranceSchema,
  voiceDirectionResultSchema,
  voiceTranscriptionResultSchema,
} from '@/modules/voice/schemas';

describe('Empire Voice contracts', () => {
  it('declares Voice as a governed EmpireOS module', () => {
    expect(manifest.id).toBe('voice');
    expect(manifest.name).toBe('Empire Voice');
    expect(manifest.route).toBe('/voice');
  });

  it('defaults live sessions to no wake phrase and no retained audio', () => {
    const parsed = createVoiceSessionSchema.parse({ deviceClass: 'mobile_web' });
    expect(parsed.wakePhraseEnabled).toBe(false);
    expect(parsed.retainAudio).toBe(false);
  });

  it('rejects utterances that are too short or exceed the bounded duration', () => {
    const base = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      utteranceId: '22222222-2222-4222-8222-222222222222',
      transcript: 'Empire, show my priorities.',
    };
    expect(submitVoiceUtteranceSchema.safeParse({ ...base, durationMs: 99 }).success).toBe(false);
    expect(submitVoiceUtteranceSchema.safeParse({ ...base, durationMs: 120001 }).success).toBe(false);
  });

  it('supports explicit echo and stop classifications', () => {
    expect(voiceDirectionResultSchema.parse({
      direction: 'not_directed',
      confidence: 0.98,
      reasonCode: 'likely_echo',
    }).reasonCode).toBe('likely_echo');

    expect(voiceDirectionResultSchema.parse({
      direction: 'stop_request',
      confidence: 1,
      reasonCode: 'explicit_stop',
    }).direction).toBe('stop_request');
  });

  it('requires real transcription provenance', () => {
    const parsed = voiceTranscriptionResultSchema.parse({
      text: 'Review my highest priority.',
      durationMs: 2100,
      provider: 'openai',
      model: 'whisper-1',
    });
    expect(parsed.provider).toBe('openai');
    expect(parsed.model).toBe('whisper-1');
  });
});
