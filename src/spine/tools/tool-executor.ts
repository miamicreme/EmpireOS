import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { consumeToolApproval } from './approval.service';
import { getTool } from './tool-registry';
import { failToolReceipt, finishToolReceipt, startToolReceipt } from './tool-receipt.service';
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
  if (!tool) return err(appError('tool_not_found', `Tool ${toolId} is not registered.`));

  const parsedInput = tool.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err(appError('validation', `Invalid input for tool ${tool.id}.`, parsedInput.error.format()));
  }

  if (tool.approvalPolicy !== 'none') {
    if (!context.approvalId) {
      return err(
        appError('tool_not_allowed', `Tool ${tool.id} requires exact-operation approval.`, {
          approvalPolicy: tool.approvalPolicy,
          riskLevel: tool.riskLevel,
        }),
      );
    }
    const consumed = await consumeToolApproval(
      context.supabase,
      context.userId,
      context.approvalId,
      tool,
      parsedInput.data,
    );
    if (!consumed.ok) return consumed;
  }

  const startedAt = nowIso();
  const startedMs = Date.now();
  const persisted = await startToolReceipt(
    context.supabase,
    context.userId,
    context.traceId,
    context.runId,
    context.approvalId,
    tool,
    parsedInput.data,
    startedAt,
  );
  if (!persisted.ok) return persisted;

  const execution = await Promise.race([
    tool.execute(context, parsedInput.data),
    new Promise<AppResult<unknown>>((resolve) => {
      setTimeout(
        () => resolve(err(appError('tool_execution_failed', `Tool ${tool.id} timed out.`, { timedOut: true }))),
        tool.timeoutMs,
      );
    }),
  ]);

  if (!execution.ok) {
    const timedOut = Boolean(
      execution.error.code === 'tool_execution_failed' &&
        typeof execution.error.details === 'object' &&
        execution.error.details &&
        'timedOut' in execution.error.details,
    );
    await failToolReceipt(
      context.supabase,
      context.userId,
      persisted.data,
      timedOut ? 'timed_out' : 'failed',
      execution.error.code,
      Date.now() - startedMs,
    );
    return execution;
  }

  const parsedOutput = tool.outputSchema.safeParse(execution.data);
  if (!parsedOutput.success) {
    await failToolReceipt(
      context.supabase,
      context.userId,
      persisted.data,
      'failed',
      'invalid_tool_output',
      Date.now() - startedMs,
    );
    return err(appError('tool_execution_failed', `Invalid output from tool ${tool.id}.`));
  }

  let verified = false;
  if (tool.verify) {
    const verification = await tool.verify(context, parsedOutput.data);
    if (!verification.ok) {
      await failToolReceipt(
        context.supabase,
        context.userId,
        persisted.data,
        'failed',
        verification.error.code,
        Date.now() - startedMs,
      );
      return verification;
    }
    verified = verification.data;
  }

  const receipt: ToolReceipt<unknown> = {
    receiptId: persisted.data,
    toolId: tool.id,
    toolVersion: tool.version,
    traceId: context.traceId,
    status: verified ? 'verified' : 'unverified',
    startedAt,
    completedAt: nowIso(),
    durationMs: Date.now() - startedMs,
    output: parsedOutput.data,
  };

  const finished = await finishToolReceipt(context.supabase, context.userId, persisted.data, receipt);
  if (!finished.ok) return finished;
  return ok(receipt);
}
