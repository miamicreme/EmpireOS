import { UniversalInputWorkbench } from '@/components/ai/UniversalInputWorkbench';

const supported = ['PDF', 'DOCX', 'TXT / MD', 'CSV / XLSX', 'image', 'screenshot', 'camera snapshot', 'sampled video frames', 'voice transcript'];

export default function AiInputPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <section className="rounded-3xl border border-border bg-surface-1/80 p-6 shadow-xl">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Universal input</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-100">Drop anything here, create an artifact, then send it to the agent.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-empire-muted">
          Kohron can attach or paste files with almost no typing. EmpireOS shows current file status, detected input kind, extracted summary, created artifact, recommended actions, approval-gated drafts, and a Send to Agent flow using <code className="rounded bg-surface-3 px-1 py-0.5">inputArtifactIds</code>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">{supported.map((item) => <span key={item} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-gray-300">{item}</span>)}</div>
      </section>
      <UniversalInputWorkbench />
    </main>
  );
}
