# AI Inference Strategy

EmpireOS should not be locked to one model vendor or one runtime.

The architecture is a provider router with a capability registry:

```txt
EmpireOS
  -> Provider Router
      -> Requesty cloud router
      -> Direct cloud providers
      -> LM Studio local/private fallback
      -> Free OpenAI-compatible fallbacks
      -> Safe stub fallback
```

## Routing order

Default env routing:

```txt
1. Requesty
2. Anthropic
3. OpenAI
4. Google
5. LM Studio
6. Groq
7. Cerebras
8. OpenRouter
9. Mistral
10. Stub
```

This keeps Requesty as the preferred cloud router, preserves direct keys, and adds LM Studio as a local/private option without making the app depend on a desktop runtime.

## LM Studio role

LM Studio is a local OpenAI-compatible provider for:

- private note summarization
- draft generation
- local testing
- classification
- routing
- low-cost short tasks
- offline-ish desktop workflows

It is not the primary production runtime.

Mobile-only warning:

```txt
An iPhone can use EmpireOS, but it cannot run LM Studio inside the browser.
LM Studio must be running on a PC, Mac, or server that the EmpireOS server can reach.
```

Flow:

```txt
iPhone -> EmpireOS web app -> EmpireOS server -> LM Studio server
```

If the LM Studio server is off, asleep, or unreachable, the provider router should skip it and use cloud providers or stub fallback.

## LM Studio env

```env
LMSTUDIO_ENABLED=true
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_DEFAULT_MODEL=qwen2.5-7b-instruct
LMSTUDIO_FAST_MODEL=llama-3.2-3b-instruct
```

Use a different base URL when LM Studio runs on another machine:

```env
LMSTUDIO_BASE_URL=http://192.168.1.50:1234/v1
```

Do not expose this URL to the browser. It is server-side only.

## Production-grade inference servers

For always-on production model serving, use inference servers built for throughput, batching, and GPU efficiency instead of LM Studio.

Recommended options:

| Runtime | Best use | Notes |
| --- | --- | --- |
| vLLM | General production LLM serving | Strong default for OpenAI-compatible serving |
| SGLang | Agentic workflows and structured generation | Good when constrained generation matters |
| Hugging Face TGI | Hugging Face deployment stack | Mature serving option |
| NVIDIA NIM | NVIDIA enterprise deployments | Best when using NVIDIA-managed model containers |
| Ollama | Personal/server-simple local models | Easier than vLLM, less production-oriented |
| LM Studio | Desktop development/testing | Best for personal local use |

## Recommended progression

Do not start with a GPU VPS unless usage proves it.

Recommended path:

```txt
Stage 1: Requesty + direct cloud providers
Stage 2: Add LM Studio on development machine for private/local testing
Stage 3: Add cheap CPU/light local runtime for embeddings/classification if needed
Stage 4: Move to vLLM/SGLang on GPU only when sustained usage justifies cost
```

## Capability registry

Providers should advertise capabilities instead of hardcoding model names throughout the app.

Capability categories:

```txt
text
vision
long_context
deep_reasoning
local_private
speech_transcription
translation
embeddings
reranking
ocr
code_generation
```

The app asks for a capability. The router chooses the best configured provider based on:

- capability match
- privacy requirement
- cost
- latency
- availability
- model strength
- fallback order

## Empire Recorder implications

Empire Recorder's text analysis can use the normal provider router.

Speech transcription is separate. LM Studio does not provide a reliable production transcription backend by default. Current speech-to-text should use a dedicated transcription provider such as OpenAI Whisper or another speech API.

Recommended split:

```txt
Audio file -> transcription provider -> transcript -> provider router -> analysis/translation/action drafts
```

## Guardrails

- All provider calls happen server-side.
- Provider keys and base URLs are never sent to the client.
- Local provider failures do not break the app.
- No sensitive source content should be logged.
- Stub mode remains available for development and empty-env deploys.
