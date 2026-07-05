import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { ok } from '@/lib/result';
import { getRecordingById, patchRecording } from '@/modules/recorder/service';
import { emitRecorderEvent } from '@/modules/recorder/events';
import { translateTranscript } from '@/modules/recorder/analysis';

export const dynamic = 'force-dynamic';

interface Body {
  id?: string;
  /** Translate even if the detected language already looks like English. */
  force?: boolean;
}

function looksEnglish(language: string | null): boolean {
  if (!language) return true; // unknown language: nothing to translate against
  return /^en(glish)?$/i.test(language.trim());
}

/** POST /api/recorder/translate — { id, force? } → translates the transcript to English. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as Body;
  if (!body.id) return jsonError(appError('validation', 'id is required.'));

  const recording = await getRecordingById(supabase, auth.data, body.id);
  if (!recording.ok) return jsonError(recording.error);
  if (!recording.data.transcript) {
    return jsonError(appError('invalid_state', 'Transcribe the recording before translating it.'));
  }

  // Already English: copy the transcript through without spending a model call.
  if (!body.force && looksEnglish(recording.data.language)) {
    const updated = await patchRecording(supabase, auth.data, body.id, {
      status: 'translated',
      translated_transcript: recording.data.transcript,
    });
    if (!updated.ok) return jsonError(updated.error);
    return jsonResult(ok({ recording: updated.data, provider: 'skipped' }));
  }

  await patchRecording(supabase, auth.data, body.id, { status: 'translating' });

  try {
    const result = await translateTranscript(supabase, auth.data, recording.data.transcript, recording.data.language);
    const updated = await patchRecording(supabase, auth.data, body.id, {
      status: 'translated',
      translated_transcript: result.translatedText,
    });
    if (!updated.ok) return jsonError(updated.error);

    await emitRecorderEvent(supabase, auth.data, 'recording.translated', body.id, { provider: result.provider });
    return jsonResult(ok({ recording: updated.data, provider: result.provider }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Translation failed.';
    await patchRecording(supabase, auth.data, body.id, { status: 'failed', error: message });
    return jsonError(appError('ai_provider_error', message));
  }
}
