import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { ok } from '@/lib/result';
import { getRecordingById, patchRecording } from '@/modules/recorder/service';
import { emitRecorderEvent } from '@/modules/recorder/events';
import { analyzeRecording } from '@/modules/recorder/analysis';

export const dynamic = 'force-dynamic';

interface Body {
  id?: string;
}

/**
 * POST /api/recorder/analyze — { id } → extracts summary/key points/decisions/
 * follow-ups/questions/names/dates/risks and drafts candidate actions.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as Body;
  if (!body.id) return jsonError(appError('validation', 'id is required.'));

  const recording = await getRecordingById(supabase, auth.data, body.id);
  if (!recording.ok) return jsonError(recording.error);

  const transcript = recording.data.translated_transcript ?? recording.data.transcript;
  if (!transcript) {
    return jsonError(appError('invalid_state', 'Transcribe the recording before analyzing it.'));
  }

  await patchRecording(supabase, auth.data, body.id, { status: 'analyzing' });

  try {
    const result = await analyzeRecording(supabase, auth.data, transcript);
    const updated = await patchRecording(supabase, auth.data, body.id, {
      status: 'ready',
      summary: result.analysis.summary,
      metadata: { ...recording.data.metadata, analysis: result.analysis, draftIds: result.drafts.map((d) => d.id) },
    });
    if (!updated.ok) return jsonError(updated.error);

    await emitRecorderEvent(supabase, auth.data, 'recording.analyzed', body.id, {
      provider: result.provider,
      draftCount: result.drafts.length,
    });
    return jsonResult(ok({ recording: updated.data, analysis: result.analysis, drafts: result.drafts, provider: result.provider }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed.';
    await patchRecording(supabase, auth.data, body.id, { status: 'failed', error: message });
    return jsonError(appError('ai_provider_error', message));
  }
}
