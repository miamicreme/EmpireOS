# AI Provider Capabilities

Provider capability metadata is centralized in `src/spine/ai/provider-capabilities.ts`.

Requesty is listed first when `REQUESTY_API_KEY` and at least one `REQUESTY_*_MODEL`
value are configured. Direct provider keys remain fallback capability providers.

LM Studio is represented as a local/private text provider when `LMSTUDIO_ENABLED=true`
and `LMSTUDIO_DEFAULT_MODEL` is set. It is not marked vision-capable or production
speech-capable by default.

## Capabilities

- `text`
- `vision`
- `longContext`
- `jsonMode`
- `cheap`
- `deepReasoning`
- `local`
- `routePurpose`
- `models`

## Provider tasks

- `text`
- `vision`
- `long_context`
- `deep_reasoning`
- `local_private`

Vision inputs require a configured vision-capable provider. If one is not configured, camera/image analysis returns `vision_provider_required` instead of pretending to analyze the image.

Local-private tasks require a reachable LM Studio provider. If one is not configured, local-private routing returns `local_provider_required` and the app should fall back to the normal cloud/provider chain only when the workflow allows it.
