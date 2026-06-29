import { z } from 'zod';

const creditItemStatus = z.enum(['open', 'disputing', 'resolved', 'archived']);

export const createCreditItemSchema = z.object({
  bureau: z.string().max(50).nullable().optional(),
  item_name: z.string().min(1).max(255),
  item_type: z.string().max(100).nullable().optional(),
  status: creditItemStatus.default('open'),
  due_at: z.string().datetime().nullable().optional(),
  next_action: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const updateCreditItemSchema = createCreditItemSchema.partial();

export type CreateCreditItemInput = z.infer<typeof createCreditItemSchema>;
export type UpdateCreditItemInput = z.infer<typeof updateCreditItemSchema>;
