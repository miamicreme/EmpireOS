import { RunDetailView } from '@/components/ai/RunDetailView';

export default function AiRunDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <section className="rounded-3xl border border-border bg-surface-1/80 p-6 shadow-xl">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Run detail</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-100">Safe agent run detail</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-empire-muted">Shows request, input artifacts, extracted summaries, created artifact, provider metadata, cost/latency, action drafts, approvals, and feedback controls without hidden chain-of-thought.</p>
      </section>
      <RunDetailView runId={params.id} />
    </main>
  );
}
