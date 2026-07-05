import type { SupabaseClient } from '@supabase/supabase-js';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';

/** Events this module emits. */
export const RECORDER_EVENTS = [
  'recorder.recording.uploaded',
  'recorder.recording.transcribed',
  'recorder.recording.translated',
  'recorder.recording.analyzed',
  'recorder.recording.failed',
  'recorder.recording.deleted',
  'module.synced',
] as const;

/** Emit a `recorder.<name>` system event, tagged to this module. */
export async function emitRecorderEvent(
  supabase: SupabaseClient,
  userId: string,
  name: 'recording.uploaded' | 'recording.transcribed' | 'recording.translated' | 'recording.analyzed' | 'recording.failed' | 'recording.deleted',
  recordingId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await emitSystemEvent(supabase, userId, {
    event_name: `recorder.${name}`,
    event_type: 'created',
    module_id: manifest.id,
    entity_type: 'recording',
    entity_id: recordingId,
    payload,
  });
}
