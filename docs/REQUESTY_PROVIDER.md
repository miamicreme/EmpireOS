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

If Requesty is missing or a Requesty call fails, EmpireOS keeps the existing backup path:

```txt
Anthropic -> OpenAI -> Google -> LM Studio -> Groq -> Cerebras -> OpenRouter -> Mistral -> stub
```

LM Studio is intentionally after the main direct cloud providers and before free-tier OpenAI-compatible fallbacks. It is useful for local/private desktop workflows, but it must be reachable from the EmpireOS server.

## LM Studio local fallback

```env
LMSTUDIO_ENABLED=true
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_DEFAULT_MODEL=qwen2.5-7b-instruct
LMSTUDIO_FAST_MODEL=llama-3.2-3b-instruct
```

Mobile-only warning:

```txt
A phone can use EmpireOS, but a phone does not run LM Studio inside the browser.
EmpireOS can use LM Studio only when the LM Studio server is running on a reachable PC, Mac, or server.
```

For production self-hosted inference, prefer vLLM, SGLang, TGI, or NVIDIA NIM instead of LM Studio. See [`docs/INFERENCE_SERVERS.md`](./INFERENCE_SERVERS.md).

## Safety

Provider health and UI surfaces show only safe metadata: configured flags, model IDs, route purpose, latency/failure placeholders, and whether cost data is available. API keys and encrypted key material are never returned to the client.
