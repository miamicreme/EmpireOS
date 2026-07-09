# Spine and Module Guardrails

EmpireOS must stay a Spine-first system.

The core law:

```txt
The Spine owns priority.
Modules own detail.
Decisions create actions.
Actions move phases.
Phases build the empire.
```

## Architecture boundary

The Spine is the central nervous system. It owns:

- priority ranking
- cross-module action aggregation
- decision context aggregation
- global health reporting
- phase movement
- final mentor/Jarvis synthesis

Modules own domain detail. A module owns:

- its database tables
- its page routes
- its API routes
- its Zod schemas
- its storage paths if needed
- its events
- its metrics
- its actions
- its decision context
- its health check

A module must expose itself through `ModuleContract` and be registered in `src/spine/module-registry.ts`.

## ModuleContract minimum

Every real module should provide:

```txt
manifest.ts
schemas.ts
types.ts
metrics.ts
actions.ts
decisions.ts
events.ts
health.ts
service.ts
```

The module service exports the module contract:

```ts
export const someModule: ModuleContract = {
  manifest,
  getMetrics,
  getActions,
  getDecisionContext,
  getHealth,
  syncToSpine,
};
```

## Fanout rule

One module must never take down the Spine.

The registry should use safe all-settled fanout for:

- sync
- metrics
- actions
- decision contexts
- health reports

If a module fails, the Spine should:

- log only safe metadata
- continue returning healthy module data
- mark the failed module red in health
- provide a safe degraded decision context
- never log raw transcripts, secrets, audio paths, private notes, or payloads

## Empire Recorder boundary

Empire Recorder is a module, not a separate AI subsystem.

It owns:

- recording UI
- consent acknowledgement
- source audio storage path
- transcript metadata
- translation metadata
- summary metadata
- recorder-specific events
- recorder health

It does not own:

- global priority
- final daily recommendation
- provider routing
- Jarvis final synthesis
- cross-module action ranking

Recorder flow must stay:

```txt
Record -> private storage -> transcript -> module artifact/context -> Spine/Jarvis action drafts
```

## AI provider boundary

Provider routing belongs to the AI layer, not individual modules.

Modules may request capabilities such as:

```txt
text
vision
long_context
deep_reasoning
local_private
speech_transcription
translation
```

Modules should not hardcode provider-specific logic unless the capability is explicitly provider-specific. Empire Recorder may use a dedicated transcription backend for speech-to-text, but its analysis/translation/follow-up reasoning should flow through the normal provider router.

## Local provider rule

LM Studio is a local/private provider option, not the production default.

Use it for:

- private short summaries
- local drafts
- classification
- routing
- development testing

Do not assume it works for mobile-only sessions. The EmpireOS server must be able to reach the LM Studio server.

## Security rule

No module should expose:

- public storage URLs
- API keys
- raw encrypted secrets
- transcripts in logs
- audio content in logs
- unredacted sensitive artifacts in health/status output

## Best-practice checklist before merging a module

- Registered through `src/spine/module-registry.ts`
- Implements `ModuleContract`
- Uses Zod on writes
- Enforces owner auth/RLS
- Emits safe system events
- Provides health checks
- Provides decision context to the Spine
- Creates action drafts rather than automatic actions when AI is involved
- Uses private storage for sensitive files
- Avoids public URLs
- Avoids raw content logging
- Has docs and manual test plan
- Does not duplicate the AI runtime
- Does not bypass the provider router
- Fails safely without taking down the Spine
