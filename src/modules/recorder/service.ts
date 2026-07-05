/**
 * Empire Recorder module. Owns `recordings` (rows) + the `recordings` Storage
 * bucket (source audio, private). Surfaces metrics, actions, and a decision
 * context to the Spine via the ModuleContract.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import type { ModuleContract } from '@/spine/module-contract';
import type { Recording, RecordingStatus } from '@/spine/types';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';
import { getMetrics } from './metrics';
import { getActions } from './actions';
import { getDecisionContext } from './decisions';
import { getHealth } from './metrics';
import { emitRecorderEvent } from './events';
import {
  uploadRecordingSchema,
  renameRecordingSchema,
  type UploadRecordingInput,
  type RenameRecordingInput,
} from './schemas';

const TABLE = 'recordings';
const BUCKET = 'recordings';

const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

function extensionFor(mimeType: string): string {
  return EXT_BY_MIME[mimeType] ?? 'bin';
}

/** Upload raw audio bytes to the private `recordings` bucket, owner-scoped by path. */
async function uploadAudioObject(
  supabase: SupabaseClient,
  userId: string,
  bytes: Buffer,
  mimeType: string,
): Promise<AppResult<string>> {
  const path = `${userId}/${randomUUID()}.${extensionFor(mimeType)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) return err(appError('internal', `Audio upload failed: ${error.message}`));
  return ok(path);
}

/**
 * Save a new recording: upload the audio bytes, then insert the row. Storage
 * writes are RLS-checked against the same authenticated user, so a failed
 * upload never leaves an orphaned DB row.
 */
export async function createRecording(
  supabase: SupabaseClient,
  userId: string,
  input: UploadRecordingInput,
  audioBytes: Buffer,
): Promise<AppResult<Recording>> {
  const parsed = uploadRecordingSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid recording upload.', parsed.error.format()));
  }

  const uploaded = await uploadAudioObject(supabase, userId, audioBytes, parsed.data.mimeType);
  if (!uploaded.ok) return uploaded;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      title: parsed.data.title,
      audio_storage_path: uploaded.data,
      mime_type: parsed.data.mimeType,
      duration_seconds: parsed.data.durationSeconds ?? null,
      consent_confirmed: parsed.data.consentConfirmed,
      status: 'uploaded' satisfies RecordingStatus,
    })
    .select('*')
    .single();

  if (error) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned object.
    await supabase.storage.from(BUCKET).remove([uploaded.data]);
    return err(appError('db_error', error.message));
  }

  const recording = data as Recording;
  await emitRecorderEvent(supabase, userId, 'recording.uploaded', recording.id, {
    mimeType: recording.mime_type,
  });
  return ok(recording);
}

export async function listRecordings(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<Recording[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as Recording[]);
}

export async function getRecordingById(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<Recording>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Recording not found.'));
  return ok(data as Recording);
}

/** A short-lived (5 min) signed URL for playback — never a stable public URL. */
export async function getRecordingAudioUrl(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<string>> {
  const recording = await getRecordingById(supabase, userId, id);
  if (!recording.ok) return recording;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(recording.data.audio_storage_path, 300);
  if (error || !data) return err(appError('internal', error?.message ?? 'Could not sign audio URL.'));
  return ok(data.signedUrl);
}

/** Download the source audio bytes for server-side processing (transcription). */
export async function downloadAudioBytes(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<{ bytes: Buffer; mimeType: string; recording: Recording }>> {
  const recording = await getRecordingById(supabase, userId, id);
  if (!recording.ok) return recording;

  const { data, error } = await supabase.storage.from(BUCKET).download(recording.data.audio_storage_path);
  if (error || !data) return err(appError('internal', error?.message ?? 'Could not download audio.'));

  const bytes = Buffer.from(await data.arrayBuffer());
  return ok({ bytes, mimeType: recording.data.mime_type, recording: recording.data });
}

export async function renameRecording(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: RenameRecordingInput,
): Promise<AppResult<Recording>> {
  const parsed = renameRecordingSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid title.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update({ title: parsed.data.title })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Recording not found.'));
  return ok(data as Recording);
}

/** Internal pipeline-stage patch — not exposed directly as a public API shape. */
export async function patchRecording(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<
    Pick<
      Recording,
      'status' | 'transcript' | 'translated_transcript' | 'summary' | 'language' | 'error' | 'metadata'
    >
  >,
): Promise<AppResult<Recording>> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Recording not found.'));
  return ok(data as Recording);
}

export async function deleteRecording(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<{ id: string }>> {
  const recording = await getRecordingById(supabase, userId, id);
  if (!recording.ok) return recording;

  await supabase.storage.from(BUCKET).remove([recording.data.audio_storage_path]);

  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', userId);
  if (error) return err(appError('db_error', error.message));

  await emitRecorderEvent(supabase, userId, 'recording.deleted', id);
  return ok({ id });
}

export const recorderModule: ModuleContract = {
  manifest,
  getMetrics: (userId) => getMetrics(createClient(), userId),
  getActions: (userId) => getActions(createClient(), userId),
  getDecisionContext: (userId) => getDecisionContext(createClient(), userId),
  getHealth: (userId) => getHealth(createClient(), userId),
  syncToSpine: async (userId) => {
    const supabase = createClient();
    await emitSystemEvent(supabase, userId, {
      event_name: 'module.synced',
      event_type: 'synced',
      module_id: manifest.id,
      payload: {},
    });
  },
};
