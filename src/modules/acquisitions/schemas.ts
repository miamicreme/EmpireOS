import { z } from 'zod';

const acquisitionStatus = z.enum([
  'watching',
  'contacted',
  'analyzing',
  'offer',
  'closed',
  'passed',
]);

export const createAcquisitionTargetSchema = z.object({
  name: z.string().min(1).max(255),
  target_type: z.string().min(1).max(100),
  location: z.string().max(255).nullable().optional(),
  asking_price: z.number().nonnegative().nullable().optional(),
  revenue: z.number().nonnegative().nullable().optional(),
  noi: z.number().nullable().optional(),
  seller_financing_possible: z.boolean().default(false),
  status: acquisitionStatus.default('watching'),
  upside_score: z.number().int().min(1).max(10).default(5),
  risk_score: z.number().int().min(1).max(10).default(5),
  next_action: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const updateAcquisitionTargetSchema = createAcquisitionTargetSchema.partial();

export type CreateAcquisitionTargetInput = z.infer<typeof createAcquisitionTargetSchema>;
export type UpdateAcquisitionTargetInput = z.infer<typeof updateAcquisitionTargetSchema>;
