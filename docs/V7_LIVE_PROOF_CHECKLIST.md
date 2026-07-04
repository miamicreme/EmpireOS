# V7 Live Proof Checklist

Use only safe mock or non-sensitive personal files. Capture screenshots in the placeholders below during manual browser verification.

The owner UI surfaces below now exist in code:
- `/ai/input`
- `/ai/camera`
- `/ai/runs/[id]`
- `/ai/memory`
- `/ai/providers`
- `/settings/security`

This checklist remains the manual browser-proof queue. Do not mark a step done until it has been verified in the browser.

## Local file proof

Covers PDF analysis, DOCX analysis, TXT/MD analysis, CSV analysis, XLSX analysis, screenshot/image analysis, camera snapshot analysis, sampled video-frame analysis, inputArtifactIds handoff, action draft creation, and vision_provider_required behavior.

| Input | Steps | Expected result | Screenshot |
| --- | --- | --- | --- |
| PDF | Open `/ai/input`, attach a safe PDF or paste extracted PDF text, click Analyze input. | `document_analysis` or `research_needed` artifact; recommended actions visible; drafts count visible. | TODO: paste screenshot path |
| DOCX | Attach a safe DOCX or paste extracted DOCX text. | `document_analysis`; high-stakes credit/legal docs become `research_needed` unless Go deeper is enabled. | TODO |
| TXT/MD | Paste or attach safe text/Markdown. | Summary, key facts, next actions, and Send to Agent enabled. | TODO |
| CSV | Attach/paste CSV rows. | `spreadsheet_analysis` with inferred purpose, totals, missing values, duplicates, and draft suggestions. | TODO |
| XLSX | Use safe XLSX exported as CSV or parser mock. | Local-first spreadsheet summary; high-stakes finance docs require deep/research state when applicable. | TODO |
| screenshot/image | Attach safe screenshot description or image. | Vision path returns `vision_provider_required` without configured vision provider; configured provider creates `vision_analysis`. | TODO |

## Camera proof

1. Open `/ai/camera`.
2. Confirm no browser permission prompt appears on page load.
3. Click Start camera and approve browser permission.
4. Click Capture snapshot.
5. Click Analyze current view.
6. Click Sample 10 seconds and confirm captured frames never exceed 10.
7. Click Stop camera and confirm the hardware/browser camera indicator turns off.
8. Delete captured frames and confirm the list clears.
9. Send created artifact to agent.

## Agent handoff proof

1. Create any artifact from `/ai/input` or `/ai/camera`.
2. Click Send to Agent.
3. Open `/ai/runs/[id]` for the resulting run.
4. Confirm input artifacts used, extracted summaries, created artifact, provider/cost/latency metadata, and action drafts are visible.
5. Confirm hidden chain-of-thought, raw provider keys, and public file URLs are not visible.

## Provider proof

- Without a vision provider configured, image/camera analysis should fail with `vision_provider_required`.
- With a configured vision provider, image/camera analysis should create `vision_analysis`, `camera_analysis`, or `video_frame_analysis` artifacts.
