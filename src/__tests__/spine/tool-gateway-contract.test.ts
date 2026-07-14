import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { appError } from '@/lib/errors';
import { err, ok } from '@/lib/result';
import { executeTool } from '@/spine/tools/tool-executor';
import { getTool, listTools } from '@/spine/tools/tool-registry';

const context = {
  userId: '00000000-0000-4000-8000-000000000001',
  supabase: {} as never,
  traceId: 'trace-test-1',
};

describe('Tool Gateway', () => {
  it('registers recorder transcription through the authoritative registry', () => {
    const tool = getTool('recorder.transcribe');
    expect(tool).toBeDefined();
    expect(tool?.moduleId).toBe('recorder');
    expect(tool?.sideEffect).toBe('reversible_write');
    expect(listTools().some((item) => item.id === 'recorder.transcribe')).toBe(true);
  });

  it('rejects unknown tools', async () => {
    const result = await executeTool('unknown.tool', context, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('tool_not_found');
  });

  it('validates tool input before execution', async () => {
    const result = await executeTool('recorder.transcribe', context, {
      recordingId: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });
});

describe('result contracts', () => {
  it('keeps typed errors stable for unavailable capabilities', () => {
    const failure = err(
      appError('capability_unavailable', 'Speech-to-text is unavailable.'),
    );
    expect(failure.ok).toBe(false);
  });

  it('supports schema-validated successful tool data', () => {
    const schema = z.object({ value: z.string() });
    const parsed = schema.safeParse({ value: 'verified' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(ok(parsed.data).data.value).toBe('verified');
  });
});
