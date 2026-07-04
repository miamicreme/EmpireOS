# AI Provider Capabilities

Provider capability metadata is centralized in `src/spine/ai/provider-capabilities.ts`.

Requesty is listed first when `REQUESTY_API_KEY` and at least one `REQUESTY_*_MODEL`
value are configured. Direct provider keys remain fallback capability providers.

## Capabilities

- `text`
- `vision`
- `longContext`
- `jsonMode`
- `cheap`
- `deepReasoning`
- `routePurpose`
- `models`

Vision inputs require a configured vision-capable provider. If one is not configured, camera/image analysis returns `vision_provider_required` instead of pretending to analyze the image.
