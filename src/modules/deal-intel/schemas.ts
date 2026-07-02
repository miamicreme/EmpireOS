import { z } from 'zod';

export const dealTypeSchema = z.enum([
  'acquire',
  'wholesale',
  'flip',
  'buy_and_hold',
  'seller_finance',
  '1031_match',
  'lend',
  'partner',
  'refer',
  'advise',
  'watchlist',
]);

export const assetClassSchema = z.enum([
  'business',
  'real_estate',
  'business_with_real_estate',
  'digital_business',
  'franchise',
  'debt_note',
  'equipment',
  'route_business',
  'mixed_asset',
  'unknown',
]);

export const verificationStatusSchema = z.enum([
  'unverified',
  'broker_provided',
  'seller_provided',
  'document_verified',
  'bank_verified',
  'tax_return_verified',
  'estimated',
  'ai_inferred',
]);

export const createDealIntelDealSchema = z.object({
  title: z.string().min(1).max(255),
  raw_input: z.string().min(1).max(50000),
  source_url: z.string().url().optional().nullable(),
  objective: z.string().min(1).max(100).default('acquire_and_operate'),
  deal_type: dealTypeSchema.default('acquire'),
});

export const analyzeDealSchema = z.object({
  analysis_depth: z.enum(['quick', 'full']).default('full'),
  objective: z.string().default('acquire_and_operate'),
  run_research: z.boolean().default(true),
  generate_visual_payload: z.boolean().default(true),
});

export const addDocumentSchema = z.object({
  document_type: z.string().min(1).default('notes'),
  title: z.string().min(1).max(255),
  raw_text: z.string().optional().nullable(),
  extracted_text: z.string().optional().nullable(),
  source_url: z.string().url().optional().nullable(),
});

export const startResearchRunSchema = z.object({
  research_types: z
    .array(
      z.enum([
        'market',
        'competitors',
        'valuation_comps',
        'owner_background',
        'property_records',
        'business_reviews',
        'industry_trends',
        'legal_risk',
        'zoning',
        'financing',
        'buyer_pool',
        'exit_strategy',
      ]),
    )
    .min(1)
    .default(['market']),
});

export const canonicalFactInputSchema = z.object({
  asset_id: z.string().uuid().optional().nullable(),
  fact_key: z.string().min(1).max(120),
  fact_value_json: z.unknown().refine((value) => value !== undefined, 'fact_value_json is required'),
  fact_type: z.string().min(1).max(60),
  unit: z.string().max(40).optional().nullable(),
  confidence_score: z.number().min(0).max(1).default(0.5),
  source_document_id: z.string().uuid().optional().nullable(),
  source_excerpt: z.string().max(1000).optional().nullable(),
  verification_status: verificationStatusSchema.default('unverified'),
  created_by: z.string().min(1).max(100).default('data_steward'),
});

export type CreateDealIntelDealInput = z.infer<typeof createDealIntelDealSchema>;
export type AnalyzeDealInput = z.infer<typeof analyzeDealSchema>;
export type AddDocumentInput = z.infer<typeof addDocumentSchema>;
export type StartResearchRunInput = z.infer<typeof startResearchRunSchema>;
export type CanonicalFactInput = z.infer<typeof canonicalFactInputSchema>;
