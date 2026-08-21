import { z } from 'zod';

export const voiceDeviceClassSchema = z.enum(['mobile_web', 'desktop_web', 'voice_node']);

export const voiceClientContextSchema = z.object({
  channel: z.literal('voice'),
  sessionId: z.string().uuid(),
  utteranceId: z.string().uuid(),
  language: z.string().trim().min(2).max(35).optional(),
  deviceClass: voiceDeviceClassSchema,
});

export const createVoiceSessionSchema = z.object({
  deviceClass: voiceDeviceClassSchema,
  language: z.string().trim().min(2).max(35).optional(),
  wakePhraseEnabled: z.boolean().default(false),
  retainAudio: z.boolean().default(false),
});

export const submitVoiceUtteranceSchema = z.object({
  sessionId: z.string().uuid(),
  utteranceId: z.string().uuid(),
  transcript: z.string().trim().min(1).max(12_000),
  language: z.string().trim().min(2).max(35).optional(),
  confidence: z.number().min(0).max(1).optional(),
  noSpeechProbability: z.number().min(0).max(1).optional(),
  durationMs: z.number().int().min(100).max(120_000),
  wakePhraseDetected: z.boolean().default(false),
  activeFollowupWindow: z.boolean().default(false),
  recentSpeechHash: z.string().length(64).optional(),
});

export const voiceDirectionResultSchema = z.object({
  direction: z.enum(['directed', 'not_directed', 'stop_request', 'ambiguous']),
  confidence: z.number().min(0).max(1),
  reasonCode: z.enum([
    'wake_phrase',
    'active_followup',
    'explicit_stop',
    'likely_echo',
    'not_addressed',
    'uncertain',
  ]),
});

export const voiceTranscriptionResultSchema = z.object({
  text: z.string().trim().min(1).max(50_000),
  language: z.string().trim().min(2).max(35).optional(),
  confidence: z.number().min(0).max(1).optional(),
  noSpeechProbability: z.number().min(0).max(1).optional(),
  durationMs: z.number().int().min(0),
  provider: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
});

export const voiceSpeechRequestSchema = z.object({
  text: z.string().trim().min(1).max(12_000),
  voice: z.string().trim().min(1).max(100).optional(),
  language: z.string().trim().min(2).max(35).optional(),
  speed: z.number().min(0.5).max(2).optional(),
});

export type CreateVoiceSessionInput = z.infer<typeof createVoiceSessionSchema>;
export type SubmitVoiceUtteranceInput = z.infer<typeof submitVoiceUtteranceSchema>;
export type VoiceSpeechInput = z.infer<typeof voiceSpeechRequestSchema>;
