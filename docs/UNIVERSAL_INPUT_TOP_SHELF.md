# Universal Input Top-Shelf Notes

EmpireOS now has a lightweight universal input contract that keeps all reasoning inside the compact agent runtime.

## Supported entry points

- `/ai/input` explains document, spreadsheet, screenshot, camera, video-frame, and transcript intake.
- `/ai/camera` documents the snapshot-first privacy flow.
- `POST /api/ai/input/upload` validates upload metadata and never returns a public URL.
- `POST /api/ai/input/analyze` normalizes submitted content into agent artifacts.
- `POST /api/ai/input/camera-frame` handles explicit snapshots only.
- `POST /api/ai/input/video-frames/analyze` accepts at most 10 sampled frames.

## Guardrails

- No silent camera activation.
- No always-on video streaming.
- High-risk secrets are blocked before analysis.
- Spreadsheet rows are summarized locally first.
- Deeper reasoning still happens through `POST /api/ai/agent/run` with artifact IDs.
