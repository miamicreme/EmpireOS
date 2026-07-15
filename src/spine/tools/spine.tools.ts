import { z } from 'zod';
import { ok } from '@/lib/result';
import {
  getAllModuleActions,
  getAllModuleMetrics,
  getModuleHealthSummary,
} from '@/spine/module-registry';
import type { ToolDefinition } from './tool.types';

const dailyContextInputSchema = z.object({
  actionLimit: z.number().int().min(1).max(20).default(5),
});

const actionSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.string(),
  moduleId: z.string().nullable(),
});

const dailyContextOutputSchema = z.object({
  actions: z.array(actionSchema),
  metricsCount: z.number().int().nonnegative(),
  moduleHealth: z.array(
    z.object({
      moduleId: z.string(),
      health: z.string(),
      reason: z.string(),
    }),
  ),
});

type DailyContextInput = z.infer<typeof dailyContextInputSchema>;
type DailyContextOutput = z.infer<typeof dailyContextOutputSchema>;

const priorityWeight: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const spineDailyContextTool: ToolDefinition<DailyContextInput, DailyContextOutput> = {
  id: 'spine.get_daily_context',
  version: '1.0.0',
  moduleId: 'spine',
  description: 'Read ranked actions, module health, and metric availability for the owner.',
  inputSchema: dailyContextInputSchema,
  outputSchema: dailyContextOutputSchema,
  riskLevel: 'read',
  sideEffect: 'none',
  approvalPolicy: 'none',
  timeoutMs: 20_000,
  async execute(context, input) {
    const [actions, metrics, health] = await Promise.all([
      getAllModuleActions(context.userId),
      getAllModuleMetrics(context.userId),
      getModuleHealthSummary(context.userId),
    ]);

    const ranked = [...actions]
      .sort((a, b) => (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0))
      .slice(0, input.actionLimit)
      .map((action) => ({
        id: action.id,
        title: action.title,
        priority: action.priority,
        moduleId: action.module_id ?? null,
      }));

    return ok({
      actions: ranked,
      metricsCount: metrics.length,
      moduleHealth: health.map((item) => ({
        moduleId: item.moduleId,
        health: item.health,
        reason: item.reason,
      })),
    });
  },
  async verify(_context, output) {
    return ok(Array.isArray(output.actions) && Array.isArray(output.moduleHealth));
  },
};
