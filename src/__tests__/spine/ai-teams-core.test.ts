import { describe, expect, it } from 'vitest';
import {
  aiAutonomyLevelSchema,
  aiMissionPrioritySchema,
  createMissionSchema,
} from '@/spine/ai/teams/team.schemas';

describe('AI Teams Core schemas', () => {
  it('requires a teamId or teamTemplateId when creating a mission', () => {
    const parsed = createMissionSchema.safeParse({
      objective: 'Prepare the next best EmpireOS build slice.',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts a mission with a team template and defaults safe approval fields', () => {
    const parsed = createMissionSchema.safeParse({
      objective: 'Analyze this deal and produce a review package.',
      teamTemplateId: '00000000-0000-0000-0000-000000000001',
      inputArtifactIds: ['00000000-0000-0000-0000-000000000002'],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.source).toBe('manual');
    expect(parsed.data.priority).toBe('medium');
    expect(parsed.data.reviewRequired).toBe(true);
    expect(parsed.data.inputArtifactIds).toHaveLength(1);
  });

  it('rejects invalid autonomy and priority values', () => {
    expect(aiAutonomyLevelSchema.safeParse('unbounded').success).toBe(false);
    expect(aiMissionPrioritySchema.safeParse('whenever').success).toBe(false);
  });
});
