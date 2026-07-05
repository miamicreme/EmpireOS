/**
 * Audio transcription.
 *
 * Speech-to-text is a distinct capability from the text-completion abstraction
 * in `provider.ts` (none of the configured chat providers accept raw audio
 * bytes here) — OpenAI Whisper is the only wired transcription backend today.
 * Absent an OpenAI key, this degrades to a deterministic stub, matching the
 * rest of the AI layer's "never require API keys to run the app" rule.
 */
import { aiKeys } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface TranscriptionResult {
  text: string;
  language: string | null;
  durationSeconds: number | null;
  provider: 'openai' | 'stub';
}

function stubTranscription(reason: string): TranscriptionResult {
  return {
    text: `[STUB] ${reason} Configure OPENAI_API_KEY to enable real transcription.`,
    language: null,
    durationSeconds: null,
    provider: 'stub',
  };
}

/**
 * Transcribe an audio file with OpenAI Whisper. `audio` is the raw file bytes
 * as uploaded by the client; `fileName` should keep a real extension since the
 * API infers format from it.
 */
export async function transcribeAudio(
  audio: Buffer,
  mimeType: string,
  fileName: string,
): Promise<TranscriptionResult> {
  const apiKey = aiKeys.openai;
  if (!apiKey) {
    return stubTranscription('No transcription provider configured.');
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

    // `verbose_json` includes `language` and `duration`; the SDK's base type
    // only guarantees `text`, so read the extra fields defensively.
    const extended = response as unknown as { text: string; language?: string; duration?: number };

    return {
      text: extended.text ?? '',
      language: extended.language ?? null,
      durationSeconds: typeof extended.duration === 'number' ? extended.duration : null,
      provider: 'openai',
    };
  } catch (error) {
    logger.warn('audio_transcription_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return stubTranscription('Transcription provider call failed.');
  }
}
