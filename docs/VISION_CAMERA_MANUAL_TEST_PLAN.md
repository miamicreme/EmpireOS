# Vision and Camera Manual Test Plan

- Open `/ai/camera` and confirm no browser permission prompt appears on page load.
- Click Start camera and confirm the browser asks for permission.
- Confirm Stop camera is visible and releases the camera indicator.
- Capture one snapshot and submit it to `/api/ai/input/camera-frame`.
- Try more than 10 sampled frames against `/api/ai/input/video-frames/analyze` and confirm validation blocks it.
- Confirm artifacts do not expose hidden chain-of-thought or provider secrets.
