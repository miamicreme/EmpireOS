/**
 * Zod schemas for the V3 agent: the run-endpoint input and the model output
 * shapes (untrusted JSON validated before use, with coercion + defaults so a
 * malformed model response never throws).
 */
import { z } from 'zod';

export const runtimePreference = z.enum(['fast', 'standard', 'deep']);
export const riskLevel = z.enum(['low', 'medium', 'high']).catch('medium');

const confidence = z.coerce.number().min(0).max(1).catch(0.5);

export const agentRunInputSchema = z.object({
  command: z.string().min(1).max(4000),
  modeHint: z.string().max(60).optional(),
  moduleHint: z.string().max(60).optional(),
  artifactTypeHint: z.string().max(60).optional(),
  runtimePreference: runtimePreference.optional(),
  threadId: z.string().uuid().nullable().optional(),
  idempotency: z.string().max(200).nullable().optional(),
  useResearch: z.boolean().optional(),
  goDeeper: z.boolean().optional(),
  inputArtifactIds: z.array(z.string().uuid()).max(10).optional(),
});
export type AgentRunInputDTO = z.infer<typeof agentRunInputSchema>;

export const suggestedDraftSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).default(''),
  category: z.string().default('general'),
  priority: z.string().default('medium'),
  moduleId: z.string().nullable().optional(),
  reason: z.string().max(2000).default(''),
  impactScore: z.coerce.number().int().min(0).max(10).catch(5).optional(),
  urgencyScore: z.coerce.number().int().min(0).max(10).catch(5).optional(),
  effortScore: z.coerce.number().int().min(0).max(10).catch(5).optional(),
  confidenceScore: z.coerce.number().min(0).max(1).catch(0.5).optional(),
});

export const synthesisOutputSchema = z.object({
  answer: z.string().default(''),
  empireBrief: z.string().max(1800).default(''),
  operatingMode: z.string().max(80).default('mentor_operator'),
  realIssue: z.string().max(1200).default(''),
  mentorNote: z.string().max(2500).default(''),
  issueBreakdown: z
    .array(
      z.object({
        topic: z.string().default(''),
        insight: z.string().default(''),
        tension: z.string().default(''),
        practicalMove: z.string().default(''),
      }),
    )
    .max(6)
    .default([]),
  leverageMap: z
    .array(
      z.object({
        lever: z.string().default(''),
        whyItMatters: z.string().default(''),
        firstProof: z.string().default(''),
      }),
    )
    .max(5)
    .default([]),
  blindSpots: z.array(z.string().max(1000)).max(6).default([]),
  antiPatterns: z.array(z.string().max(1000)).max(5).default([]),
  decisionPath: z
    .array(
      z.object({
        step: z.string().default(''),
        reason: z.string().default(''),
        doneWhen: z.string().default(''),
      }),
    )
    .max(5)
    .default([]),
  creativeAngles: z.array(z.string().max(1000)).max(5).default([]),
  conversationStarters: z.array(z.string().max(500)).max(4).default([]),
  nextBestQuestion: z.string().max(500).default(''),
  reasoningSummary: z.string().default(''),
  assumptions: z.array(z.string()).default([]),
  evidence: z
    .array(
      z.object({
        claim: z.string().default(''),
        source: z.string().default('context_pack'),
        strength: z.enum(['weak', 'moderate', 'strong']).catch('moderate'),
      }),
    )
    .default([]),
  options: z
    .array(
      z.object({
        option: z.string().default(''),
        why: z.string().default(''),
        risks: z.array(z.string()).default([]),
        nextStep: z.string().default(''),
      }),
    )
    .default([]),
  whatWouldChangeMyMind: z.array(z.string()).default([]),
  confidence,
  riskLevel,
  risks: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  nextActions: z
    .array(
      z.object({
        title: z.string().default(''),
        priority: z.string().default('medium'),
        reason: z.string().default(''),
      }),
    )
    .default([]),
  suggestedDrafts: z.array(suggestedDraftSchema).default([]),
});

export const specialistVoteSchema = z.object({
  recommendation: z.string().default(''),
  reasoningSummary: z.string().default(''),
  confidence,
  risks: z.array(z.string()).default([]),
  missingData: z.array(z.string()).default([]),
});

export const approveDraftSchema = z.object({
  action: z.enum(['approve', 'reject']).default('approve'),
  edits: z
    .object({
      title: z.string().min(1).max(300).optional(),
      description: z.string().max(5000).nullable().optional(),
      category: z.string().optional(),
      priority: z.string().optional(),
    })
    .optional(),
});

export const batchApproveSchema = z.object({
  all: z.boolean().optional(),
  ids: z.array(z.string().uuid()).optional(),
});

export const saveMemorySchema = z.object({
  memoryType: z.string().min(1).max(60),
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(5000),
  summary: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
  confidence: z.coerce.number().min(0).max(1).catch(0.8).optional(),
});

export const updateMemorySchema = z.object({
  memoryType: z.string().min(1).max(60).optional(),
  title: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(5000).nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
});

export const feedbackSchema = z.object({
  runId: z.string().uuid().nullable().optional(),
  artifactId: z.string().uuid().nullable().optional(),
  feedbackType: z.enum([
    'thumbs_up',
    'thumbs_down',
    'correction',
    'rating',
    'save_memory',
    'never_again',
  ]),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
  suggestedCorrection: z.string().max(2000).optional(),
  shouldSaveAsMemory: z.boolean().optional(),
  neverSuggestAgain: z.boolean().optional(),
  needsResearchNextTime: z.boolean().optional(),
});

export const universalInputAnalyzeSchema = z.object({
  inputType: z.enum(['pdf', 'docx', 'txt', 'md', 'csv', 'xlsx', 'image', 'screenshot', 'camera_snapshot', 'video_frames', 'voice_transcript']),
  fileName: z.string().max(240).optional(),
  mimeType: z.string().max(120).optional(),
  contentText: z.string().max(100_000).optional(),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(500).optional(),
  imageDescription: z.string().max(5000).optional(),
  imageBase64: z.string().max(14_000_000).optional(),
  frameDescriptions: z.array(z.string().max(2000)).max(10).optional(),
  frameImagesBase64: z.array(z.string().max(14_000_000)).max(10).optional(),
  transcript: z.string().max(50_000).optional(),
  createDrafts: z.boolean().optional(),
  allowVision: z.boolean().optional(),
  allowDeepAnalysis: z.boolean().optional(),
});
export type UniversalInputAnalyzeDTO = z.infer<typeof universalInputAnalyzeSchema>;
