import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createRecording } from '@/modules/recorder/service';
import { MAX_AUDIO_BYTES, type UploadRecordingInput } from '@/modules/recorder/schemas';

export const dynamic = 'force-dynamic';

/** Browsers report MediaRecorder mime types with a codec suffix (e.g.
 * "audio/webm;codecs=opus"); strip it so it matches the stored enum. */
function baseMimeType(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() ?? mime;
}

/**
 * POST /api/recorder/upload — multipart/form-data:
 *   audio             (File, required)
 *   title             (string, optional)
 *   durationSeconds   (string number, optional)
 *   consentConfirmed  ("true", required)
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(appError('validation', 'Expected multipart/form-data with an "audio" file.'));
  }

  const file = form.get('audio');
  if (!(file instanceof File)) {
    return jsonError(appError('validation', 'Missing "audio" file field.'));
  }
  if (file.size === 0) {
    return jsonError(appError('validation', 'Audio file is empty.'));
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return jsonError(
      appError('validation', `Audio exceeds the ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))}MB limit.`),
    );
  }

  const titleField = form.get('title');
  const durationField = form.get('durationSeconds');
  const bytes = Buffer.from(await file.arrayBuffer());

  return jsonResult(
    await createRecording(
      supabase,
      auth.data,
      {
        title: typeof titleField === 'string' && titleField.trim() ? titleField : undefined,
        mimeType: baseMimeType(file.type),
        durationSeconds:
          typeof durationField === 'string' && durationField.trim() ? Number(durationField) : undefined,
        consentConfirmed: form.get('consentConfirmed') === 'true',
      } as unknown as UploadRecordingInput,
      bytes,
    ),
    201,
  );
}
