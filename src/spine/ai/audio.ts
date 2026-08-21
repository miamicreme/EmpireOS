/**
 * Audio transcription capability.
 *
 * Speech-to-text is distinct from chat completion. This service returns a typed
 * failure when no real transcription backend is configured; it never returns a
 * fake transcript or marks stub output as successful work.
 */
import { aiKeys } from '@/lib/env';
import { logger } from '@/lib/logger';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';

export interface TranscriptionResult {
  text: string;
  language: string | null;
  durationSeconds: number | null;
  provider: 'openai';
}

/**
 * Transcribe an audio file with OpenAI Whisper. `audio` is the raw file bytes
 * as uploaded by the client; `fileName` should retain a supported extension.
 */
export async function transcribeAudio(
  audio: Buffer,
  mimeType: string,
  fileName: string,
): Promise<AppResult<TranscriptionResult>> {
  const apiKey = aiKeys.openai;
  if (!apiKey) {
    return err(
      appError(
        'capability_unavailable',
        'Audio transcription is not configured.',
        {
          capability: 'speech_to_text',
          requiredConfiguration: ['OPENAI_API_KEY'],
        },
      ),
    );
  }

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });
    const file = new File([new Uint8Array(audio)], fileName, { type: mimeType });

    const response = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
    });

    const extended = response as unknown as {
      text: string;
      language?: string;
      duration?: number;
    };

    if (!extended.text?.trim()) {
      return err(appError('ai_provider_error', 'Transcription provider returned an empty transcript.'));
    }

    return ok({
      text: extended.text,
      language: extended.language ?? null,
      durationSeconds: typeof extended.duration === 'number' ? extended.duration : null,
      provider: 'openai',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription provider call failed.';
    logger.warn('audio_transcription_failed', { error: message });
    return err(appError('ai_provider_error', 'Audio transcription failed.', { provider: 'openai' }));
  }
}
