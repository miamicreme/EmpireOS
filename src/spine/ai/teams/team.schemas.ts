import { z } from 'zod';

export const aiTeamTypeSchema = z.enum(['executive', 'domain', 'capability', 'mission', 'subteam']);
export const aiAutonomyLevelSchema = z.enum(['manual', 'supervised', 'review_required', 'autonomous_limited']);
export const aiSpawnPolicySchema = z.enum(['manual_only', 'suggested', 'auto_after_approval']);
export const aiMissionSourceSchema = z.enum(['manual', 'spine_action', 'artifact', 'recorder', 'module', 'daily_brief']);
export const aiMissionStatusSchema = z.enum(['draft', 'pending_approval', 'approved', 'running', 'review', 'done', 'blocked', 'cancelled']);
export const aiMissionPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const aiMissionTaskStatusSchema = z.enum(['backlog', 'ready', 'running', 'review', 'done', 'blocked']);
export const aiMemoryScopeSchema = z.enum(['mission', 'team', 'module', 'global_redacted']);
export const aiMissionTransitionActionSchema = z.enum(['approve', 'start', 'send_to_review', 'complete', 'block', 'cancel']);

const stringArray = z.array(z.string().min(1).max(120)).max(40).default([]);
const uuidArray = z.array(z.string().uuid()).max(20).default([]);
const metadataSchema = z.record(z.unknown()).default({});

export const aiTeamTemplateSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  parent_template_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  slug: z.string(),
  type: aiTeamTypeSchema,
  group_name: z.string().nullable().optional(),
  purpose: z.string(),
  default_autonomy_level: aiAutonomyLevelSchema,
  allowed_module_ids: stringArray,
  allowed_action_types: stringArray,
  default_member_roles: stringArray,
  spawn_policy: aiSpawnPolicySchema,
  max_concurrent_missions: z.number().int().positive(),
  active: z.boolean(),
  metadata: metadataSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type AiTeamTemplate = z.infer<typeof aiTeamTemplateSchema>;

export const aiTeamMemberTemplateSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  team_template_id: z.string().uuid(),
  name: z.string(),
  role: z.string(),
  lens: z.string(),
  responsibilities: stringArray,
  tools_allowed: stringArray,
  blocked_actions: stringArray,
  model_preference: z.string().nullable().optional(),
  memory_scope: aiMemoryScopeSchema,
  requires_review: z.boolean(),
  metadata: metadataSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type AiTeamMemberTemplate = z.infer<typeof aiTeamMemberTemplateSchema>;

export const aiTeamSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  template_id: z.string().uuid().nullable().optional(),
  parent_team_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  slug: z.string(),
  type: aiTeamTypeSchema,
  purpose: z.string(),
  default_autonomy_level: aiAutonomyLevelSchema,
  allowed_module_ids: stringArray,
  allowed_action_types: stringArray,
  spawn_policy: aiSpawnPolicySchema,
  max_concurrent_missions: z.number().int().positive(),
  status: z.enum(['active', 'inactive', 'archived']),
  metadata: metadataSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type AiTeam = z.infer<typeof aiTeamSchema>;

export const aiTeamMemberSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  team_id: z.string().uuid(),
  template_member_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  role: z.string(),
  lens: z.string(),
  responsibilities: stringArray,
  tools_allowed: stringArray,
  blocked_actions: stringArray,
  model_preference: z.string().nullable().optional(),
  memory_scope: aiMemoryScopeSchema,
  requires_review: z.boolean(),
  status: z.enum(['active', 'inactive', 'archived']),
  metadata: metadataSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type AiTeamMember = z.infer<typeof aiTeamMemberSchema>;

export const aiMissionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  team_id: z.string().uuid().nullable(),
  source: aiMissionSourceSchema,
  source_id: z.string().nullable().optional(),
  title: z.string(),
  objective: z.string(),
  status: aiMissionStatusSchema,
  priority: aiMissionPrioritySchema,
  module_ids: stringArray,
  input_artifact_ids: uuidArray,
  linked_action_draft_ids: uuidArray,
  autonomy_level: aiAutonomyLevelSchema,
  review_required: z.boolean(),
  approved_at: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  cancelled_at: z.string().nullable().optional(),
  metadata: metadataSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type AiMission = z.infer<typeof aiMissionSchema>;

export const createMissionSchema = z
  .object({
    title: z.string().min(1).max(240).optional(),
    objective: z.string().min(1).max(5000),
    source: aiMissionSourceSchema.default('manual'),
    sourceId: z.string().max(200).nullable().optional(),
    teamId: z.string().uuid().nullable().optional(),
    teamTemplateId: z.string().uuid().nullable().optional(),
    moduleIds: z.array(z.string().min(1).max(80)).max(12).default([]),
    inputArtifactIds: uuidArray,
    linkedActionDraftIds: uuidArray,
    priority: aiMissionPrioritySchema.default('medium'),
    autonomyLevel: aiAutonomyLevelSchema.optional(),
    reviewRequired: z.boolean().default(true),
    metadata: metadataSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.teamId && !value.teamTemplateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['teamTemplateId'],
        message: 'teamId or teamTemplateId is required.',
      });
    }
  });
export type CreateMissionDTO = z.infer<typeof createMissionSchema>;

export const listMissionsQuerySchema = z.object({
  status: aiMissionStatusSchema.optional(),
  teamId: z.string().uuid().optional(),
});
export type ListMissionsQuery = z.infer<typeof listMissionsQuerySchema>;

export const missionTransitionSchema = z.object({
  action: aiMissionTransitionActionSchema,
  note: z.string().max(2000).optional(),
});
export type MissionTransitionDTO = z.infer<typeof missionTransitionSchema>;
