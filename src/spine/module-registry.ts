/**
 * Module Registry V3.
 *
 * The Spine discovers modules only through this registry. Each module exposes a
 * ModuleContract; the registry fans out across them for aggregate views.
 */
import { cashEngineModule } from '@/modules/cash-engine/service';
import { jobHuntModule } from '@/modules/job-hunt/service';
import { followupCrmModule } from '@/modules/followup-crm/service';
import type { ModuleContract } from './module-contract';
import type {
  DecisionContext,
  GlobalAction,
  ModuleHealthResult,
  ModuleMetric,
} from './types';

export const moduleRegistry: ReadonlyArray<ModuleContract> = [
  cashEngineModule,
  jobHuntModule,
  followupCrmModule,
];

export function getActiveModules(): ReadonlyArray<ModuleContract> {
  return moduleRegistry;
}

export function getModuleById(id: string): ModuleContract | undefined {
  return moduleRegistry.find((m) => m.manifest.id === id);
}

export async function syncAllModulesToSpine(userId: string): Promise<void> {
  await Promise.all(moduleRegistry.map((m) => m.syncToSpine(userId)));
}

export async function getAllModuleMetrics(
  userId: string,
): Promise<ModuleMetric[]> {
  const all = await Promise.all(moduleRegistry.map((m) => m.getMetrics(userId)));
  return all.flat();
}

export async function getAllModuleActions(
  userId: string,
): Promise<GlobalAction[]> {
  const all = await Promise.all(moduleRegistry.map((m) => m.getActions(userId)));
  return all.flat();
}

export async function getAllDecisionContexts(
  userId: string,
): Promise<DecisionContext[]> {
  return Promise.all(moduleRegistry.map((m) => m.getDecisionContext(userId)));
}

export async function getModuleHealthSummary(
  userId: string,
): Promise<ModuleHealthResult[]> {
  return Promise.all(moduleRegistry.map((m) => m.getHealth(userId)));
}
