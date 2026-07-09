import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { appError } from '@/lib/errors';
import { ok } from '@/lib/result';
import { analyzeRecording, translateTranscript } from '@/modules/recorder/analysis';
import { emitRecorderEvent } from '@/modules/recorder/events';
import { downloadAudioBytes, getRecordingById, patchRecording } from '@/modules/recorder/service';
import { transcribeAudio } from '@/spine/ai/audio';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

function looksEnglish(language: string | null): boolean {
  if (!language) return true;
  return /^en(glish)?$/i.test(language.trim());
}

/**
 * POST /api/recorder/[id]/process
 *
 * Explicit owner action that runs transcription, translation, and analysis.
 * This keeps the recorder consent-first: upload/save does not send audio to AI
 * until the owner clicks Process.
 */
export async function POST(_request: Request, { params }: Params) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const id = params.id;
  if (!id) return jsonError(appError('validation', 'Recording id is required.'));

  const current = await getRecordingById(supabase, auth.data, id);
  if (!current.ok) return jsonError(current.error);

  try {
    let transcript = current.data.transcript;
    let translatedTranscript = current.data.translated_transcript;
    let language = current.data.language;

    if (!transcript) {
      const downloaded = await downloadAudioBytes(supabase, auth.data, id);
      if (!downloaded.ok) return jsonError(downloaded.error);

      await patchRecording(supabase, auth.data, id, { status: 'transcribing', error: null });
      const transcribed = await transcribeAudio(downloaded.data.bytes, downloaded.data.mimeType, `${id}.audio`);
      transcript = transcribed.text;
      language = transcribed.language;

      const updated = await patchRecording(supabase, auth.data, id, {
        status: 'transcribed',
        transcript,
        language,
        error: null,
      });
      if (!updated.ok) return jsonError(updated.error);

      await emitRecorderEvent(supabase, auth.data, 'recording.transcribed', id, {
        provider: transcribed.provider,
        language,
      });
    }

    if (!translatedTranscript) {
      if (looksEnglish(language)) {
        translatedTranscript = transcript;
        const updated = await patchRecording(supabase, auth.data, id, {
          status: 'translated',
          translated_transcript: translatedTranscript,
          error: null,
        });
        if (!updated.ok) return jsonError(updated.error);
      } else {
        await patchRecording(supabase, auth.data, id, { status: 'translating', error: null });
        const translated = await translateTranscript(supabase, auth.data, transcript, language);
        translatedTranscript = translated.translatedText;

        const updated = await patchRecording(supabase, auth.data, id, {
          status: 'translated',
          translated_transcript: translatedTranscript,
          error: null,
        });
        if (!updated.ok) return jsonError(updated.error);

        await emitRecorderEvent(supabase, auth.data, 'recording.translated', id, {
          provider: translated.provider,
        });
      }
    }

    const latest = await getRecordingById(supabase, auth.data, id);
    if (!latest.ok) return jsonError(latest.error);

    const analysisTranscript = latest.data.translated_transcript ?? latest.data.transcript;
    if (!analysisTranscript) {
      return jsonError(appError('invalid_state', 'Transcription returned no transcript to analyze.'));
    }

    await patchRecording(supabase, auth.data, id, { status: 'analyzing', error: null });
    const analyzed = await analyzeRecording(supabase, auth.data, analysisTranscript);
    const updated = await patchRecording(supabase, auth.data, id, {
      status: 'ready',
      summary: analyzed.analysis.summary,
      metadata: {
        ...latest.data.metadata,
        analysis: analyzed.analysis,
        draftIds: analyzed.drafts.map((draft) => draft.id),
      },
      error: null,
    });
    if (!updated.ok) return jsonError(updated.error);

    await emitRecorderEvent(supabase, auth.data, 'recording.analyzed', id, {
      provider: analyzed.provider,
      draftCount: analyzed.drafts.length,
    });

    return jsonResult(
      ok({
        recording: updated.data,
        analysis: analyzed.analysis,
        drafts: analyzed.drafts,
        provider: analyzed.provider,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recording processing failed.';
    await patchRecording(supabase, auth.data, id, { status: 'failed', error: message });
    return jsonError(appError('ai_provider_error', message));
  }
}
