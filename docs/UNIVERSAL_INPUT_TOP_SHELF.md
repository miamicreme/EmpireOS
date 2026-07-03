# Universal Input Top-Shelf Notes

EmpireOS now has a universal input intelligence layer that keeps all reasoning inside the compact agent runtime.

## Supported entry points

- `/ai/input` explains document, spreadsheet, screenshot, camera, video-frame, and transcript intake.
- `/ai/camera` documents the snapshot-first privacy flow.
- `POST /api/ai/input/upload` validates upload metadata and never returns a public URL.
- `POST /api/ai/input/analyze` normalizes submitted content into agent artifacts.
- `POST /api/ai/input/camera-frame` handles explicit snapshots only.
- `POST /api/ai/input/video-frames/analyze` accepts at most 10 sampled frames.

## Intelligence layer

- `file-ingestion.service.ts` normalizes input and blocks high-risk secrets.
- `document-intelligence.service.ts` handles PDF/DOCX/TXT/MD text after extraction.
- `spreadsheet-intelligence.service.ts` provides deterministic CSV/XLSX summaries before AI.
- `vision-intelligence.service.ts` routes images/screenshots/camera/video frames to a vision-capable provider or returns `vision_provider_required`.
- `cost-governor.service.ts` enforces file, text, chunk, and video-frame limits.

## Artifact fields

Artifacts include title, summary, key facts, risks, opportunities, recommended actions, confidence, source references, safety metadata, and routing/cost metadata. Deeper reasoning still happens through `POST /api/ai/agent/run` with `inputArtifactIds`.
