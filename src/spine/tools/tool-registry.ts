import { recorderTranscribeTool } from './recorder.tools';
import { spineDailyContextTool } from './spine.tools';
import { approveActionDraftTool } from './action-draft.tools';
import type { AnyToolDefinition } from './tool.types';

const tools = [
  recorderTranscribeTool as unknown as AnyToolDefinition,
  spineDailyContextTool as unknown as AnyToolDefinition,
  approveActionDraftTool as unknown as AnyToolDefinition,
] as const;

const registry = new Map<string, AnyToolDefinition>(tools.map((tool) => [tool.id, tool]));

export function getTool(toolId: string): AnyToolDefinition | undefined {
  return registry.get(toolId);
}

export function listTools(): ReadonlyArray<
  Pick<
    AnyToolDefinition,
    'id' | 'version' | 'moduleId' | 'description' | 'riskLevel' | 'sideEffect' | 'approvalPolicy'
  >
> {
  return tools.map((tool) => ({
    id: tool.id,
    version: tool.version,
    moduleId: tool.moduleId,
    description: tool.description,
    riskLevel: tool.riskLevel,
    sideEffect: tool.sideEffect,
    approvalPolicy: tool.approvalPolicy,
  }));
}
