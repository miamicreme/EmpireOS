/**
 * Module Contract V3.
 *
 * Every module plugs into the Spine through this single interface. The Spine
 * never reaches into module internals — it only calls these methods.
 */
import type {
  DecisionContext,
  GlobalAction,
  ModuleHealthResult,
  ModuleManifest,
  ModuleMetric,
} from './types';

export type { DecisionContext, ModuleHealthResult } from './types';

export interface ModuleContract {
  manifest: ModuleManifest;

  /** Module-owned metrics for the user (already scoped by user_id via RLS). */
  getMetrics: (userId: string) => Promise<ModuleMetric[]>;

  /** Open/ranked actions this module surfaces to the Spine. */
  getActions: (userId: string) => Promise<GlobalAction[]>;

  /** Redaction-ready context the decision engine can consume. */
  getDecisionContext: (userId: string) => Promise<DecisionContext>;

  /** Module health (green/yellow/red) with a human reason. */
  getHealth: (userId: string) => Promise<ModuleHealthResult>;

  /** Push module-derived metrics/actions into the Spine layer. */
  syncToSpine: (userId: string) => Promise<void>;
}
