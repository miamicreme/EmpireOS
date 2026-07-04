'use client';

import type { RefObject } from 'react';
import { Button } from '@/components/ui/Button';

export function CameraCapture({
  videoRef,
  streamActive,
  status,
  onStart,
  onStop,
  onCaptureSnapshot,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  streamActive: boolean;
  status: string;
  onStart: () => void;
  onStop: () => void;
  onCaptureSnapshot: () => void;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-xl">
      <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Camera capture</p>
      <h2 className="mt-2 text-xl font-semibold text-gray-100">Camera is off until you start it.</h2>
      <p className="mt-2 text-sm leading-6 text-empire-muted">
        EmpireOS analyzes only frames you capture. No default streaming. Stop camera releases the browser camera tracks.
      </p>

      <div className="mt-4 rounded-2xl border border-border bg-surface-0 p-3">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="aspect-video w-full rounded-xl border border-border bg-black object-cover"
        />
        <p className="mt-3 text-xs font-mono text-empire-muted">{status}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onStart} disabled={streamActive}>
          Start Camera
        </Button>
        <Button variant="secondary" onClick={onCaptureSnapshot} disabled={!streamActive}>
          Capture Snapshot
        </Button>
        <Button variant="danger" onClick={onStop} disabled={!streamActive}>
          Stop camera
        </Button>
      </div>
    </section>
  );
}
