/**
 * Module Registry V3.
 *
 * The Spine discovers modules only through this registry. Each module exposes a
 * ModuleContract; the registry fans out across them for aggregate views.
 *
 * Best-practice rule: one module must never take down the Spine. Aggregate
 * fanout uses all-settled behavior and logs safe module-level failures without
 * logging domain content, transcripts, secrets, or raw payloads.
 */
import { cashEngineModule } from '@/modules/cash-engine/service';
import { financesModule } from '@/modules/finances/service';
import { jobHuntModule } from '@/modules/job-hunt/service';
import { followupCrmModule } from '@/modules/followup-crm/service';
import { creditFundingModule } from '@/modules/credit-funding/service';
import { projectsModule } from '@/modules/projects/service';
import { acquisitionsModule } from '@/modules/acquisitions/service';
import { dealIntelModule } from '@/modules/deal-intel/service';
import { recorderModule } from '@/modules/recorder/service';
import { logger } from '@/lib/logger';
import type { ModuleContract } from './module-contract';
import type { ModuleHealthCheck } from './module-contract';
import type {
  DecisionContext,
  GlobalAction,
  ModuleHealthResult,
  ModuleMetric,
} from './types';

export const moduleRegistry: ReadonlyArray<ModuleContract> = [
  cashEngineModule,
  financesModule,
  jobHuntModule,
  followupCrmModule,
  creditFundingModule,
  projectsModule,
  acquisitionsModule,
  dealIntelModule,
  recorderModule,
];

export function getActiveModules(): ReadonlyArray<ModuleContract> {
  return moduleRegistry;
}

export function getAllModules(): ReadonlyArray<ModuleContract> {
  return moduleRegistry;
}

export function getModuleById(id: string): ModuleContract | undefined {
  return moduleRegistry.find((m) => m.manifest.id === id);
}

type ModuleFanoutResult<T> = {
  moduleId: string;
  value: T;
};

function safeErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

async function fanoutModules<T>(
  operation: string,
  run: (module: ModuleContract) => Promise<T>,
): Promise<Array<ModuleFanoutResult<T>>> {
  const settled = await Promise.allSettled(
    moduleRegistry.map(async (module) => ({
      moduleId: module.manifest.id,
      value: await run(module),
    })),
  );

  const values: Array<ModuleFanoutResult<T>> = [];
  settled.forEach((result, index) => {
    const moduleId = moduleRegistry[index]?.manifest.id ?? 'unknown';
    if (result.status === 'fulfilled') {
      values.push(result.value);
      return;
    }

    logger.warn('module_registry_fanout_failed', {
      operation,
      moduleId,
      error: safeErrorMessage(result.reason),
    });
  });

  return values;
}

export async function syncAllModulesToSpine(userId: string): Promise<void> {
  await fanoutModules('syncToSpine', (module) => module.syncToSpine(userId));
}

export async function getAllModuleMetrics(
  userId: string,
): Promise<ModuleMetric[]> {
  const all = await fanoutModules('getMetrics', (module) => module.getMetrics(userId));
  return all.flatMap((result) => result.value);
}

export async function getAllModuleActions(
  userId: string,
): Promise<GlobalAction[]> {
  const all = await fanoutModules('getActions', (module) => module.getActions(userId));
  return all.flatMap((result) => result.value);
}

export async function getAllDecisionContexts(
  userId: string,
): Promise<DecisionContext[]> {
  const all = await fanoutModules('getDecisionContext', (module) => module.getDecisionContext(userId));
  const healthyContexts = all.map((result) => result.value);
  const returned = new Set(all.map((result) => result.moduleId));

  const failedContexts = moduleRegistry
    .filter((module) => !returned.has(module.manifest.id))
    .map<DecisionContext>((module) => ({
      moduleId: module.manifest.id,
      summary: `${module.manifest.name} is temporarily unavailable.`,
      facts: { health: 'red', route: module.manifest.route },
      risks: ['This module failed during Spine context fanout.'],
      opportunities: [],
      recommendedActions: ['Check module health before relying on this module.'],
    }));

  return [...healthyContexts, ...failedContexts];
}

export async function getModuleHealthSummary(
  userId: string,
): Promise<ModuleHealthResult[]> {
  const all = await fanoutModules('getHealth', (module) => module.getHealth(userId));
  const health = all.map((result) => result.value);
  const returned = new Set(all.map((result) => result.moduleId));

  const failedHealth = moduleRegistry
    .filter((module) => !returned.has(module.manifest.id))
    .map<ModuleHealthResult>((module) => ({
      moduleId: module.manifest.id,
      health: 'red',
      reason: `${module.manifest.name} health check failed during module fanout.`,
    }));

  return [...health, ...failedHealth];
}

/** Returns a ModuleHealthCheck[] compatible with the module-contract type. */
export async function getModuleHealthReport(
  userId: string,
): Promise<ModuleHealthCheck[]> {
  const results = await getModuleHealthSummary(userId);
  return results.map((r) => ({
    moduleId: r.moduleId,
    health: r.health,
    summary: r.reason,
    issues: r.health !== 'green' ? [r.reason] : [],
  }));
}
