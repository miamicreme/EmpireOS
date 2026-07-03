import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function AiCameraPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <section className="rounded-3xl border border-border bg-surface-1/80 p-6 shadow-xl">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Camera review</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-100">Snapshot-first visual intelligence with privacy controls.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-empire-muted">
          EmpireOS does not silently activate your camera and does not stream video by default. Capture is a deliberate browser permission flow, and submitted frames become safe camera artifacts for the compact agent runtime.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface-2/70 p-5">
          <h2 className="font-semibold text-gray-100">1. Start camera</h2>
          <p className="mt-2 text-sm text-empire-muted">Request browser permission only after you click Start. Keep a visible Stop camera control.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-2/70 p-5">
          <h2 className="font-semibold text-gray-100">2. Capture snapshot</h2>
          <p className="mt-2 text-sm text-empire-muted">Submit one selected frame to <code>/api/ai/input/camera-frame</code>; delete local frames you do not want analyzed.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-2/70 p-5">
          <h2 className="font-semibold text-gray-100">3. Optional sample</h2>
          <p className="mt-2 text-sm text-empire-muted">Sample at most 10 frames for a short review. Always avoid continuous background recording.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-empire-blue/30 bg-surface-2/70 p-6">
        <h2 className="text-lg font-semibold text-gray-100">Manual privacy checklist</h2>
        <ul className="mt-3 grid gap-2 text-sm text-empire-muted sm:grid-cols-2">
          <li>Camera starts only after a click.</li>
          <li>Browser permission prompt is visible.</li>
          <li>Stop camera button releases tracks.</li>
          <li>Captured frames can be deleted before analysis.</li>
          <li>No video stream is stored by default.</li>
          <li>Vision provider fallback is explicit when unavailable.</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button>Start camera</Button>
          <Button variant="secondary">Analyze current view</Button>
          <Button variant="ghost">Sample 10 seconds</Button>
          <Link className="rounded-lg border border-border px-3 py-2 text-sm text-gray-200" href="/ai/input">Open universal input</Link>
        </div>
      </section>
    </main>
  );
}
