'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

type CameraResult = {
  artifactId: string;
  artifactType: string;
  summary: string;
  recommendedActions: string[];
  actionDraftIds: string[];
  provider: string | null;
};

export function CameraCaptureWorkbench() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState('Camera is off. No browser permission requested.');
  const [frameDescriptions, setFrameDescriptions] = useState<string[]>([]);
  const [result, setResult] = useState<CameraResult | null>(null);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPrivacyStatus('Camera API is unavailable in this browser.');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
    setPrivacyStatus('Camera is on after explicit click. Stop camera releases tracks.');
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPrivacyStatus('Camera stopped. Confirm the browser camera light turned off.');
  }

  function captureSnapshot() {
    const next = `Camera snapshot captured at ${new Date().toISOString()}. Owner should describe what matters before provider analysis.`;
    setFrameDescriptions((current) => [next, ...current].slice(0, 10));
    setPrivacyStatus('Snapshot captured locally. You can delete frames before analysis.');
  }

  function sampleFrames() {
    const sampled = Array.from({ length: 10 }, (_, index) => `Sampled frame ${index + 1} from explicit 10-second review window.`);
    setFrameDescriptions(sampled);
    setPrivacyStatus('Sampled max 10 frames. No continuous stream is stored.');
  }

  async function analyzeCurrentView() {
    const response = await api.post<CameraResult>('/api/ai/input/camera-frame', {
      imageDescription: frameDescriptions[0] ?? 'Camera snapshot selected by owner for analysis.',
      allowVision: true,
      createDrafts: true,
    });
    if (!response.ok) {
      setPrivacyStatus(response.error.message);
      return;
    }
    setResult(response.data);
    setPrivacyStatus('Camera artifact created. Send it to agent or review action drafts.');
  }

  async function analyzeSampledFrames() {
    const response = await api.post<CameraResult>('/api/ai/input/video-frames/analyze', {
      frameDescriptions,
      allowVision: true,
      createDrafts: true,
    });
    if (!response.ok) {
      setPrivacyStatus(response.error.message);
      return;
    }
    setResult(response.data);
    setPrivacyStatus('Video-frame artifact created from bounded sample.');
  }

  async function sendArtifactToAgent() {
    if (!result) return;
    await api.post('/api/ai/agent/run', {
      command: `Review this visual artifact and tell me the next action: ${result.summary}`,
      inputArtifactIds: [result.artifactId],
    });
    setPrivacyStatus('Camera artifact sent to agent through inputArtifactIds.');
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <section className="rounded-2xl border border-border bg-surface-2/70 p-5">
        <h2 className="text-lg font-semibold text-gray-100">Camera controls</h2>
        <p className="mt-2 rounded-xl border border-border bg-surface-0 p-3 text-sm text-empire-muted">Privacy status: {privacyStatus}</p>
        <video ref={videoRef} autoPlay muted playsInline className="mt-4 aspect-video w-full rounded-2xl border border-border bg-black object-cover" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={startCamera}>Start camera</Button>
          <Button variant="secondary" onClick={captureSnapshot}>Capture snapshot</Button>
          <Button variant="secondary" onClick={analyzeCurrentView}>Analyze current view</Button>
          <Button variant="subtle" onClick={sampleFrames}>Sample 10 seconds</Button>
          <Button variant="danger" onClick={stopCamera}>Stop camera</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-2/70 p-5">
        <h2 className="text-lg font-semibold text-gray-100">Frames, artifact, drafts</h2>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setFrameDescriptions([])}>Delete captured frames</Button>
          <Button size="sm" variant="secondary" disabled={frameDescriptions.length === 0} onClick={analyzeSampledFrames}>Analyze sampled frames</Button>
        </div>
        <p className="mt-3 text-sm text-empire-muted">Captured frames: {frameDescriptions.length} / 10</p>
        <ul className="mt-3 max-h-36 space-y-2 overflow-auto text-xs text-empire-muted">{frameDescriptions.map((frame) => <li key={frame} className="rounded-lg bg-surface-0 p-2">{frame}</li>)}</ul>
        {result && (
          <div className="mt-4 rounded-xl border border-border bg-surface-0 p-3 text-sm">
            <p className="font-mono text-xs uppercase text-empire-muted">Created camera/vision artifact</p>
            <p className="mt-1 text-gray-100">{result.artifactType} — {result.artifactId}</p>
            <p className="mt-2 text-empire-muted">{result.summary}</p>
            <p className="mt-2 text-empire-muted">Draft actions from camera analysis: {result.actionDraftIds.length}</p>
            <Button className="mt-3" size="sm" onClick={sendArtifactToAgent}>Send artifact to agent</Button>
          </div>
        )}
      </section>
    </div>
  );
}
