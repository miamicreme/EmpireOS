import { z } from 'zod';
import { err, ok } from '@/lib/result';
import { appError } from '@/lib/errors';
import { transcribeAudio } from '@/spine/ai/audio';
import { downloadAudioBytes, patchRecording } from '@/modules/recorder/service';
import { emitRecorderEvent } from '@/modules/recorder/events';
import type { ToolDefinition } from './tool.types';

const transcribeInputSchema = z.object({
  recordingId: z.string().uuid(),
});

const transcribeOutputSchema = z.object({
  recordingId: z.string().uuid(),
  provider: z.literal('openai'),
  language: z.string().nullable(),
  transcriptLength: z.number().int().nonnegative(),
});

type TranscribeInput = z.infer<typeof transcribeInputSchema>;
type TranscribeOutput = z.infer<typeof transcribeOutputSchema>;

export const recorderTranscribeTool: ToolDefinition<TranscribeInput, TranscribeOutput> = {
  id: 'recorder.transcribe',
  version: '1.0.0',
  moduleId: 'recorder',
  description: 'Transcribe owner-scoped private audio and persist the verified transcript.',
  inputSchema: transcribeInputSchema,
  outputSchema: transcribeOutputSchema,
  riskLevel: 'low',
  sideEffect: 'reversible_write',
  approvalPolicy: 'none',
  timeoutMs: 120_000,
  async execute(context, input) {
    const downloaded = await downloadAudioBytes(
      context.supabase,
      context.userId,
      input.recordingId,
    );
    if (!downloaded.ok) return downloaded;

    const marking = await patchRecording(context.supabase, context.userId, input.recordingId, {
      status: 'transcribing',
      error: null,
    });
    if (!marking.ok) return marking;

    const extension = downloaded.data.mimeType.includes('webm') ? 'webm' : 'audio';
    const transcription = await transcribeAudio(
      downloaded.data.bytes,
      downloaded.data.mimeType,
      `${input.recordingId}.${extension}`,
    );

    if (!transcription.ok) {
      await patchRecording(context.supabase, context.userId, input.recordingId, {
        status: 'failed',
        error: transcription.error.message,
      });
      return err(transcription.error);
    }

    const updated = await patchRecording(context.supabase, context.userId, input.recordingId, {
      status: 'transcribed',
      transcript: transcription.data.text,
      language: transcription.data.language,
      error: null,
    });
    if (!updated.ok) return updated;

    await emitRecorderEvent(
      context.supabase,
      context.userId,
      'recording.transcribed',
      input.recordingId,
      {
        provider: transcription.data.provider,
        language: transcription.data.language,
        traceId: context.traceId,
      },
    );

    const output: TranscribeOutput = {
      recordingId: input.recordingId,
      provider: transcription.data.provider,
      language: transcription.data.language,
      transcriptLength: transcription.data.text.length,
    };

    const parsed = transcribeOutputSchema.safeParse(output);
    if (!parsed.success) {
      return err(appError('tool_execution_failed', 'Recorder transcription output failed validation.'));
    }

    return ok(parsed.data);
  },
  async verify(context, output) {
    const recording = await patchRecording(context.supabase, context.userId, output.recordingId, {});
    if (!recording.ok) return recording;
    return ok(
      recording.data.status === 'transcribed' &&
        typeof recording.data.transcript === 'string' &&
        recording.data.transcript.length === output.transcriptLength,
    );
  },
};
