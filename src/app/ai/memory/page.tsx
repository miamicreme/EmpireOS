import { PageHeader } from '@/components/ui/PageHeader';
import { MemoryWorkbench } from '@/components/ai/memory/MemoryWorkbench';

export const dynamic = 'force-dynamic';

export default function AiMemoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Memory"
        subtitle="Durable memory items with safe status controls and owner-only edits."
      />
      <MemoryWorkbench />
    </main>
  );
}

