import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { ok } from '@/lib/result';
import { getRecordingById, deleteRecording, renameRecording, getRecordingAudioUrl } from '@/modules/recorder/service';
import type { RenameRecordingInput } from '@/modules/recorder/schemas';

export const dynamic = 'force-dynamic';

/** GET /api/recorder/:id — recording detail, including a 60s signed audio URL. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const recording = await getRecordingById(supabase, auth.data, params.id);
  if (!recording.ok) return jsonError(recording.error);

  const audioUrl = await getRecordingAudioUrl(supabase, auth.data, params.id);
  return jsonResult(ok({ ...recording.data, audioUrl: audioUrl.ok ? audioUrl.data : null }));
}

/** PATCH /api/recorder/:id — rename only; pipeline fields are server-owned. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as RenameRecordingInput;
  return jsonResult(await renameRecording(supabase, auth.data, params.id, body));
}

/** DELETE /api/recorder/:id — removes the DB row and the stored audio object. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await deleteRecording(supabase, auth.data, params.id));
}
