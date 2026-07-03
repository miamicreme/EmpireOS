# Camera Vision

Camera vision is snapshot-first. The server never activates hardware; browser code must request permission only after an explicit user action.

## Required UX

1. Show a privacy notice before requesting permission.
2. Start camera only after a click.
3. Provide a visible Stop camera button.
4. Let the owner delete captured frames before analysis.
5. Submit one snapshot to `/api/ai/input/camera-frame` or up to 10 sampled descriptions to `/api/ai/input/video-frames/analyze`.

## Runtime rules

Submitted camera artifacts are safe summaries for the compact `agent_*` runtime and can be referenced by `POST /api/ai/agent/run`.
