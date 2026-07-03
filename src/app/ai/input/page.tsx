import { Button } from '@/components/ui/Button';

const acceptedInputs = [
  'PDF',
  'DOCX',
  'TXT / MD',
  'CSV / XLSX',
  'images and screenshots',
  'camera snapshots',
  'sampled video frames',
  'voice transcripts',
];

export default function AiInputPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <section className="rounded-3xl border border-border bg-surface-1/80 p-6 shadow-xl">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Universal input</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-100">Drop anything here, then route it through the one AI command path.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-empire-muted">
          EmpireOS analyzes documents, spreadsheets, screenshots, camera frames, and transcripts as compact agent artifacts. The next step is always explicit: review the safe summary, then run <code className="rounded bg-surface-3 px-1 py-0.5">POST /api/ai/agent/run</code> with the artifact reference.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-dashed border-empire-blue/50 bg-surface-2/70 p-6">
          <h2 className="text-xl font-semibold text-gray-100">Analyze an input</h2>
          <p className="mt-2 text-sm text-empire-muted">Use the upload contract for validation, extraction routes for text-like files, and the universal analyzer for standardized artifacts.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {acceptedInputs.map((input) => (
              <div key={input} className="rounded-xl border border-border bg-surface-0 p-3 text-sm text-gray-200">{input}</div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button>Analyze document</Button>
            <Button variant="secondary">Analyze spreadsheet</Button>
            <Button variant="ghost">Draft next actions</Button>
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-surface-2/70 p-6">
          <h2 className="text-lg font-semibold text-gray-100">Safety contract</h2>
          <ul className="mt-3 space-y-3 text-sm text-empire-muted">
            <li>No public file URLs are returned by upload validation.</li>
            <li>High-risk secrets are blocked before durable analysis.</li>
            <li>CSV/XLSX receives deterministic local summaries before any AI reasoning.</li>
            <li>Camera and video flows require explicit user action.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
