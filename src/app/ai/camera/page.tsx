import Link from 'next/link';
import { CameraCaptureWorkbench } from '@/components/ai/CameraCaptureWorkbench';

export default function AiCameraPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <section className="rounded-3xl border border-border bg-surface-1/80 p-6 shadow-xl">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Camera review</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-100">Snapshot-first visual intelligence with explicit privacy controls.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-empire-muted">
          The camera does not silently activate your camera and never starts on page load. Start camera requires a click, snapshots are optional, sampled video is capped at 10 frames, Stop camera releases tracks, and captured frames can be deleted before analysis. Use Sample 10 seconds only when you want bounded frame review.
        </p>
        <Link className="mt-4 inline-flex rounded-lg border border-border px-3 py-2 text-sm text-gray-200" href="/ai/input">Open universal input</Link>
      </section>
      <CameraCaptureWorkbench />
    </main>
  );
}
