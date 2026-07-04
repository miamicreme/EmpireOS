import { PageHeader } from '@/components/ui/PageHeader';
import { RunDetailWorkbench } from '@/components/ai/runs/RunDetailWorkbench';

export const dynamic = 'force-dynamic';

export default function AiRunDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Run Detail"
        subtitle="Safe summaries only. No hidden chain-of-thought, no secrets, no raw provider payloads."
      />
      <RunDetailWorkbench runId={params.id} />
    </main>
  );
}

