# Module Template

Copy this folder to create a new Empire OS module.

## Steps

1. Copy `src/modules/_template` → `src/modules/<your-module>`.
2. Update `manifest.ts` (`id`, `slug`, `name`, `route`, `phaseId`, `capabilities`).
3. Add the module's own table(s) in a new migration if it owns domain data.
4. Implement:
   - `metrics.ts` — compute `ModuleMetric[]` from your tables.
   - `actions.ts` — surface `GlobalAction[]` (usually via `getActionsByModule`).
   - `decisions.ts` — build a `DecisionContext` (redaction-ready).
   - `service.ts` — assemble the `ModuleContract` and implement `getHealth`.
5. Register the module in `src/spine/module-registry.ts`.
6. Insert a row into the `modules` reference table (see `supabase/seed.sql`).

## Contract

Every module exports a `ModuleContract`:

```ts
manifest, getMetrics, getActions, getDecisionContext, getHealth, syncToSpine
```

The Spine only ever talks to a module through this contract — never reach into a
module's internals from the Spine.
