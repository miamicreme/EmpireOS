# Module Design (Backend V3)

Modules own their business domain. They never bypass the Spine: all priority,
ranking, and scoring flow through it. A module communicates with the Spine only
through the **Module Contract**.

## Module Contract

`src/spine/module-contract.ts`:

```ts
export interface ModuleContract {
  manifest: ModuleManifest;
  getMetrics: (userId: string) => Promise<ModuleMetric[]>;
  getActions: (userId: string) => Promise<GlobalAction[]>;
  getDecisionContext: (userId: string) => Promise<DecisionContext>;
  getHealth: (userId: string) => Promise<ModuleHealthResult>;
  syncToSpine: (userId: string) => Promise<void>;
}
```

## Module manifest

```ts
interface ModuleManifest {
  id: string; name: string; slug: string; description: string;
  phaseId: string; route: string; icon?: string;
  capabilities: string[]; priority: number;
}
```

The manifest is mirrored as a row in the `modules` reference table (seeded in
`supabase/seed.sql`).

## How to create a new module

1. Copy `src/modules/_template` → `src/modules/<your-module>`.
2. Edit `manifest.ts` (id/slug/route/phaseId/capabilities).
3. If the module owns data, add its table(s) in a new migration with RLS.
4. Implement `metrics.ts`, `actions.ts`, `decisions.ts`, and `getHealth`.
5. Assemble the `ModuleContract` in `service.ts`.
6. Register it in `src/spine/module-registry.ts`.
7. Add a row to the `modules` reference table.

## How module data syncs to the Spine

- **Actions**: modules write into the shared `global_actions` table (tagged with
  `module_id`) and read them back via `getActionsByModule`.
- **Metrics**: modules either record snapshots into `module_metrics` or compute
  derived metrics on demand in `getMetrics`.
- **Events**: meaningful changes emit a `system_event` (e.g.
  `cash.entry.created`). `syncToSpine` emits `module.synced`.
- **Health**: `getHealth` returns green/yellow/red, aggregated by the registry.

## Reference modules

- `cash-engine` — owns `cash_entries`; metric `cash_today` vs daily target.
- `job-hunt` — owns `job_applications`; metrics for active pipeline.
- `followup-crm` — owns `contacts`; metric for follow-ups due.
