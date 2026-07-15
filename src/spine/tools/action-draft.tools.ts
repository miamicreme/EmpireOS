import { z } from 'zod';
import { err, ok } from '@/lib/result';
import { appError } from '@/lib/errors';
import {
  approveActionDraft,
  getActionDraftById,
} from '@/spine/ai/action-draft.service';
import type { ToolDefinition } from './tool.types';

const inputSchema = z.object({
  actionDraftId: z.string().uuid(),
});

const outputSchema = z.object({
  actionDraftId: z.string().uuid(),
  actionId: z.string().uuid(),
  title: z.string().min(1),
  status: z.literal('approved'),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export const approveActionDraftTool: ToolDefinition<Input, Output> = {
  id: 'spine.approve_action_draft',
  version: '1.0.0',
  moduleId: 'spine',
  description: 'Convert one exact owner-approved AI action draft into a real Spine action.',
  inputSchema,
  outputSchema,
  riskLevel: 'medium',
  sideEffect: 'reversible_write',
  approvalPolicy: 'confirm',
  timeoutMs: 20_000,
  async execute(context, input) {
    const approved = await approveActionDraft(
      context.supabase,
      context.userId,
      input.actionDraftId,
    );
    if (!approved.ok) return approved;

    return ok({
      actionDraftId: approved.data.draft.id,
      actionId: approved.data.action.id,
      title: approved.data.action.title,
      status: 'approved' as const,
    });
  },
  async verify(context, output) {
    const draft = await getActionDraftById(
      context.supabase,
      context.userId,
      output.actionDraftId,
    );
    if (!draft.ok) return draft;
    if (draft.data.status !== 'approved' || draft.data.created_action_id !== output.actionId) {
      return err(appError('tool_execution_failed', 'Approved action draft failed postcondition verification.'));
    }
    return ok(true);
  },
};
