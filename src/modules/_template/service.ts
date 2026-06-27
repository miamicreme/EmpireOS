/**
 * Template module — assembles the ModuleContract from the local pieces.
 *
 * To create a new module: copy this folder, rename, point the manifest at your
 * route/phase, and implement metrics/actions/decisions/health against your own
 * tables. The contract is what the Spine and module registry consume.
 */
import { createClient } from '@/lib/supabase/server';
import type { ModuleContract } from '@/spine/module-contract';
import type { ModuleHealthResult } from '@/spine/types';
import { manifest } from './manifest';
import { getMetrics } from './metrics';
import { getActions } from './actions';
import { getDecisionContext } from './decisions';
import { emitSyncedEvent } from './events';

async function getHealth(userId: string): Promise<ModuleHealthResult> {
  void userId;
  return { moduleId: manifest.id, health: 'yellow', reason: 'Template module.' };
}

export const templateModule: ModuleContract = {
  manifest,
  getMetrics: (userId) => getMetrics(createClient(), userId),
  getActions: (userId) => getActions(createClient(), userId),
  getDecisionContext: (userId) => getDecisionContext(createClient(), userId),
  getHealth,
  syncToSpine: async (userId) => {
    await emitSyncedEvent(createClient(), userId);
  },
};
