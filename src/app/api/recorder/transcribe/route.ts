import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { ok } from '@/lib/result';
import { downloadAudioBytes, patchRecording } from '@/modules/recorder/service';
import { emitRecorderEvent } from '@/modules/recorder/events';
import { transcribeAudio } from '@/spine/ai/audio';

export const dynamic = 'force-dynamic';

interface Body {
  id?: string;
}

/** POST /api/recorder/transcribe — { id } → transcribes the stored audio in place. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as Body;
  if (!body.id) return jsonError(appError('validation', 'id is required.'));

  const downloaded = await downloadAudioBytes(supabase, auth.data, body.id);
  if (!downloaded.ok) return jsonError(downloaded.error);

  await patchRecording(supabase, auth.data, body.id, { status: 'transcribing' });

  try {
    const result = await transcribeAudio(downloaded.data.bytes, downloaded.data.mimeType, `${body.id}.audio`);
    const updated = await patchRecording(supabase, auth.data, body.id, {
      status: 'transcribed',
      transcript: result.text,
      language: result.language,
    });
    if (!updated.ok) return jsonError(updated.error);

    await emitRecorderEvent(supabase, auth.data, 'recording.transcribed', body.id, {
      provider: result.provider,
      language: result.language,
    });
    return jsonResult(ok({ recording: updated.data, provider: result.provider }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed.';
    await patchRecording(supabase, auth.data, body.id, { status: 'failed', error: message });
    return jsonError(appError('ai_provider_error', message));
  }
}
