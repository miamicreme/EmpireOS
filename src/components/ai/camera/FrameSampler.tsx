'use client';

import { Button } from '@/components/ui/Button';

export interface SampledFrame {
  id: string;
  file: File;
  description: string;
  capturedAt: string;
}

export function FrameSampler({
  frames,
  sampling,
  onSampleFrames,
  onAnalyzeFrames,
  onDeleteFrames,
  analysisAvailable,
  status,
}: {
  frames: SampledFrame[];
  sampling: boolean;
  onSampleFrames: () => void;
  onAnalyzeFrames: () => void;
  onDeleteFrames: () => void;
  analysisAvailable: boolean;
  status: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-xl">
      <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Frame sampler</p>
      <h2 className="mt-2 text-xl font-semibold text-gray-100">Sample frames in a bounded 10-second window</h2>
      <p className="mt-2 text-sm leading-6 text-empire-muted">
        Sample 10 seconds. Cap is 10 frames. The UI samples at 1 frame per second and keeps the captures local until you analyze them.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onSampleFrames} loading={sampling}>
          Sample 10 seconds
        </Button>
        <Button variant="secondary" onClick={onAnalyzeFrames} disabled={frames.length === 0 || !analysisAvailable}>
          Analyze sampled frames
        </Button>
        <Button variant="ghost" onClick={onDeleteFrames} disabled={frames.length === 0}>
          Delete Frames
        </Button>
      </div>

      <p className="mt-3 text-xs font-mono text-empire-muted">
        Captured frames: {frames.length} / 10 · {status}
      </p>

      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {frames.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface-0 p-4 text-sm text-empire-muted">
            No sampled frames yet.
          </p>
        ) : (
          frames.map((frame) => (
            <div key={frame.id} className="rounded-2xl border border-border bg-surface-0 p-3">
              <p className="text-sm text-gray-100">{frame.file.name}</p>
              <p className="mt-1 text-xs font-mono text-empire-muted">{frame.capturedAt}</p>
              <p className="mt-2 text-sm text-empire-muted">{frame.description}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

