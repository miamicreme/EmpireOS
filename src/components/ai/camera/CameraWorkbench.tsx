'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { CameraCapture } from './CameraCapture';
import { CameraArtifactResult } from './CameraArtifactResult';
import { FrameSampler, type SampledFrame } from './FrameSampler';
import type { InputAnalyzeResult } from '../input/InputArtifactResult';

type AgentRunResult = {
  runId: string;
  status: string;
  answer: string;
  actionDrafts: Array<{ id: string; title: string; category: string; priority: string; approvalStatus: string }>;
};

function isUnavailable(err: string) {
  return /\(404\)|not wired|unexpected response/i.test(err);
}

function canvasToFile(video: HTMLVideoElement, prefix: string) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable in this browser.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not capture a browser snapshot.'));
        return;
      }
      resolve(new File([blob], `${prefix}-${Date.now()}.png`, { type: blob.type || 'image/png' }));
    }, 'image/png');
  });
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read captured image bytes.'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.split(',')[1] ?? '' : value);
    };
    reader.readAsDataURL(file);
  });
}

export function CameraWorkbench() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplingAbortRef = useRef(false);
  const [status, setStatus] = useState('Camera is off until you start it.');
  const [error, setError] = useState<string | null>(null);
  const [snapshotFile, setSnapshotFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<SampledFrame[]>([]);
  const [snapshotResult, setSnapshotResult] = useState<InputAnalyzeResult | null>(null);
  const [frameResult, setFrameResult] = useState<InputAnalyzeResult | null>(null);
  const [runResult, setRunResult] = useState<AgentRunResult | null>(null);
  const [sampling, setSampling] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [notWired, setNotWired] = useState(false);

  useEffect(
    () => () => {
      samplingAbortRef.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function startCamera() {
    setError(null);
    setNotWired(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is unavailable in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStreamActive(true);
      setStatus('Camera permission granted. Capture a snapshot or sample frames.');
    } catch (err) {
      setStreamActive(false);
      setStatus('Camera permission denied or unavailable.');
      setError(err instanceof Error ? err.message : 'Camera permission denied.');
    }
  }

  function stopCamera() {
    samplingAbortRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreamActive(false);
    setSampling(false);
    setStatus('Camera stopped. Confirm the browser camera indicator is off.');
  }

  async function captureSnapshot() {
    if (!videoRef.current || !streamRef.current) {
      setError('Start the camera before capturing a snapshot.');
      return;
    }
    try {
      const file = await canvasToFile(videoRef.current, 'camera-snapshot');
      setSnapshotFile(file);
      setStatus(`Snapshot captured locally: ${file.name}`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not capture a snapshot.');
    }
  }

  async function analyzeSnapshot() {
    if (!snapshotFile) {
      setError('Capture a snapshot first.');
      return;
    }
    setError(null);
    setStatus('Analyzing explicit snapshot...');
    const imageBase64 = await fileToBase64(snapshotFile);
    const response = await api.post<InputAnalyzeResult>('/api/ai/input/camera-frame', {
      inputType: 'camera_snapshot',
      fileName: snapshotFile.name,
      mimeType: snapshotFile.type,
      imageDescription: `Owner-captured camera snapshot ${snapshotFile.name}.`,
      imageBase64,
      createDrafts: true,
      allowVision: true,
    });
    if (!response.ok) {
      setError(response.error.message);
      setNotWired(isUnavailable(response.error.message));
      setStatus(response.error.message);
      return;
    }
    setSnapshotResult(response.data);
    setFrameResult(null);
    setStatus('Camera snapshot analyzed.');
  }

  async function sampleFrames() {
    if (!videoRef.current || !streamRef.current) {
      setError('Start the camera before sampling frames.');
      return;
    }

    samplingAbortRef.current = false;
    setSampling(true);
    setError(null);
    setStatus('Sampling 10 frames over 10 seconds...');
    setFrames([]);
    setSnapshotResult(null);
    setFrameResult(null);

    const captured: SampledFrame[] = [];
    const started = Date.now();
    while (!samplingAbortRef.current && captured.length < 10 && Date.now() - started < 10_000) {
      try {
        const file = await canvasToFile(videoRef.current, 'camera-frame');
        const capturedAt = new Date().toISOString();
        captured.push({
          id: `${file.name}-${captured.length + 1}`,
          file,
          capturedAt,
          description: `Frame ${captured.length + 1} captured at ${capturedAt} from the owner-selected camera stream.`,
        });
        setFrames([...captured]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not capture sampled frame.');
        break;
      }
      if (captured.length < 10) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setSampling(false);
    setStatus(`Sampled ${captured.length} frame(s) in a bounded 10-second window.`);
  }

  async function analyzeSampledFrames() {
    if (frames.length === 0) {
      setError('Sample frames before analyzing them.');
      return;
    }
    setError(null);
    setStatus('Analyzing sampled frames...');
    const frameImagesBase64 = await Promise.all(frames.slice(0, 10).map((frame) => fileToBase64(frame.file)));
    const response = await api.post<InputAnalyzeResult>('/api/ai/input/video-frames/analyze', {
      inputType: 'video_frames',
      frameDescriptions: frames.map((frame) => frame.description).slice(0, 10),
      frameImagesBase64,
      createDrafts: true,
      allowVision: true,
    });
    if (!response.ok) {
      setError(response.error.message);
      setNotWired(isUnavailable(response.error.message));
      setStatus(response.error.message);
      return;
    }
    setFrameResult(response.data);
    setSnapshotResult(null);
    setStatus('Sampled frames analyzed.');
  }

  async function sendToAgent() {
    const result = snapshotResult ?? frameResult;
    if (!result) {
      setError('Create a camera artifact before sending it to the agent.');
      return;
    }
    setError(null);
    setStatus('Sending camera artifact to the agent...');
    const response = await api.post<AgentRunResult>('/api/ai/agent/run', {
      command: `Review this visual artifact and give the next owner action. Summary: ${result.summary}`,
      inputArtifactIds: [result.artifactId],
      createActionDrafts: true,
      modeHint: 'camera',
      goDeeper: true,
    });
    if (!response.ok) {
      setError(response.error.message);
      setStatus(response.error.message);
      return;
    }
    setRunResult(response.data);
    setStatus(`Agent run created: ${response.data.runId}`);
  }

  function deleteFrames() {
    samplingAbortRef.current = true;
    setFrames([]);
    setFrameResult(null);
    setStatus('Captured frames cleared.');
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.04fr_0.96fr]">
      <div className="space-y-5">
        <CameraCapture
          videoRef={videoRef}
          streamActive={streamActive}
          status={status}
          onStart={() => void startCamera()}
          onStop={stopCamera}
          onCaptureSnapshot={() => void captureSnapshot()}
        />

        <section className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-xl">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Privacy contract</p>
          <ul className="mt-3 space-y-2 text-sm text-empire-muted">
            <li>Camera is off until you start it.</li>
            <li>EmpireOS analyzes only frames you capture.</li>
            <li>No default streaming.</li>
            <li>Stop camera releases the browser camera tracks.</li>
            {notWired && <li>One requested analysis route is not wired yet and surfaced a safe error.</li>}
          </ul>
        </section>
      </div>

      <div className="space-y-5">
        <FrameSampler
          frames={frames}
          sampling={sampling}
          onSampleFrames={() => void sampleFrames()}
          onAnalyzeFrames={() => void analyzeSampledFrames()}
          onDeleteFrames={deleteFrames}
          analysisAvailable={true}
          status={status}
        />

        <CameraArtifactResult
          snapshotName={snapshotFile?.name ?? null}
          snapshotResult={snapshotResult}
          frameResult={frameResult}
          runResult={runResult}
          error={error}
          onSendToAgent={() => void sendToAgent()}
        />
      </div>
    </div>
  );
}
