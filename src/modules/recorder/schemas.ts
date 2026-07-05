import { z } from 'zod';

/** Formats accepted from a browser MediaRecorder / file picker. */
export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
] as const;

/** 60MB — a few hours of compressed (opus/aac) speech; generous for one sitting. */
export const MAX_AUDIO_BYTES = 60 * 1024 * 1024;

export const recordingStatus = z.enum([
  'uploaded',
  'transcribing',
  'transcribed',
  'translating',
  'translated',
  'analyzing',
  'ready',
  'failed',
]);

/** Metadata accompanying an audio upload. The file itself travels as multipart form data. */
export const uploadRecordingSchema = z.object({
  title: z.string().trim().min(1).max(200).default('Untitled recording'),
  mimeType: z.enum(ALLOWED_AUDIO_MIME_TYPES),
  durationSeconds: z.coerce.number().min(0).max(24 * 60 * 60).nullable().optional(),
  // Explicit, required consent gate — recording without it must fail closed.
  consentConfirmed: z.literal(true, {
    errorMap: () => ({ message: 'Consent to record must be confirmed before saving.' }),
  }),
});

export const renameRecordingSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export type UploadRecordingInput = z.infer<typeof uploadRecordingSchema>;
export type RenameRecordingInput = z.infer<typeof renameRecordingSchema>;
