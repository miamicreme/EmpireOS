# AI Provider Capabilities

Provider capability metadata is centralized in `src/spine/ai/provider-capabilities.ts`.

## Capabilities

- `text`
- `vision`
- `longContext`
- `jsonMode`
- `cheap`
- `deepReasoning`

Vision inputs require a configured vision-capable provider. If one is not configured, camera/image analysis returns `vision_provider_required` instead of pretending to analyze the image.
