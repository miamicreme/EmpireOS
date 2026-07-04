# Requesty Provider

Requesty is the preferred AI gateway when configured. EmpireOS calls Requesty's OpenAI-compatible API once, and Requesty routes to the model selected for the runtime purpose.

## Environment

```env
REQUESTY_API_KEY=your_requesty_key_here
REQUESTY_BASE_URL=https://router.requesty.ai/v1
REQUESTY_DEFAULT_MODEL=choose-model-id-from-requesty
REQUESTY_FAST_MODEL=choose-fast-cheap-model
REQUESTY_STANDARD_MODEL=choose-standard-model
REQUESTY_DEEP_MODEL=choose-deep-model
REQUESTY_VISION_MODEL=choose-vision-model
```

Copy the exact base URL and model IDs from Requesty. The base URL defaults to `https://router.requesty.ai/v1` only as a local fallback.

## Routing

- `instant` / `fast` uses `REQUESTY_FAST_MODEL`.
- `standard` uses `REQUESTY_STANDARD_MODEL`.
- `deep` / high-stakes uses `REQUESTY_DEEP_MODEL`.
- `vision` / image / camera uses `REQUESTY_VISION_MODEL`.

If Requesty is missing or a Requesty call fails, EmpireOS keeps the existing direct provider key path as backup: Anthropic, OpenAI, Google, Groq, Cerebras, OpenRouter, Mistral, then stub mode.

## Safety

Provider health and UI surfaces show only safe metadata: configured flags, model IDs, route purpose, latency/failure placeholders, and whether cost data is available. API keys and encrypted key material are never returned to the client.
