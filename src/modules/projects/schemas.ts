import { z } from 'zod';

const projectStatus = z.enum(['active', 'paused', 'complete', 'archived']);
const focusLevel = z.enum(['low', 'medium', 'high']);

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  status: projectStatus.default('active'),
  focus_level: focusLevel.default('medium'),
  revenue_potential: z.number().nonnegative().optional(),
  strategic_value: z.number().int().min(1).max(10).default(5),
  next_action: z.string().max(500).optional(),
  blocker: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
