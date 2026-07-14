import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { getTool } from './tool-registry';
import type { ToolExecutionContext, ToolReceipt } from './tool.types';

function nowIso(): string {
  return new Date().toISOString();
}

export async function executeTool(
  toolId: string,
  context: ToolExecutionContext,
  rawInput: unknown,
): Promise<AppResult<ToolReceipt<unknown>>> {
  const tool = getTool(toolId);
  if (!tool) {
    return err(appError('tool_not_found', `Tool ${toolId} is not registered.`));
  }

  if (
    tool.approvalPolicy !== 'none' &&
    !context.approvedToolIds?.has(tool.id)
  ) {
    return err(
      appError('tool_not_allowed', `Tool ${tool.id} requires approval.`, {
        approvalPolicy: tool.approvalPolicy,
        riskLevel: tool.riskLevel,
      }),
    );
  }

  const parsedInput = tool.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err(
      appError('validation', `Invalid input for tool ${tool.id}.`, parsedInput.error.format()),
    );
  }

  const startedAt = nowIso();
  const startedMs = Date.now();

  const execution = await Promise.race([
    tool.execute(context, parsedInput.data),
    new Promise<AppResult<unknown>>((resolve) => {
      setTimeout(
        () => resolve(err(appError('tool_execution_failed', `Tool ${tool.id} timed out.`))),
        tool.timeoutMs,
      );
    }),
  ]);

  if (!execution.ok) return execution;

  const parsedOutput = tool.outputSchema.safeParse(execution.data);
  if (!parsedOutput.success) {
    return err(
      appError('tool_execution_failed', `Invalid output from tool ${tool.id}.`),
    );
  }

  let verified = false;
  if (tool.verify) {
    const verification = await tool.verify(context, parsedOutput.data);
    if (!verification.ok) return verification;
    verified = verification.data;
  }

  const completedAt = nowIso();
  return ok({
    toolId: tool.id,
    traceId: context.traceId,
    status: verified ? 'verified' : 'unverified',
    startedAt,
    completedAt,
    durationMs: Date.now() - startedMs,
    output: parsedOutput.data,
  });
}
