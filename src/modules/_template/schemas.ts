import { z } from 'zod';

/** Validate all module inputs before writes. */
export const createTemplateRecordSchema = z.object({
  name: z.string().min(1).max(200),
});

export type CreateTemplateRecordInput = z.infer<typeof createTemplateRecordSchema>;
