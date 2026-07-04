import { PageHeader } from '@/components/ui/PageHeader';
import { AiInputWorkbench } from '@/components/ai/input/AiInputWorkbench';

export default function AiInputPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Universal Input"
        subtitle="Upload a file, paste text, analyze it into a safe artifact, then hand it to the single agent run path."
      />
      <AiInputWorkbench />
    </main>
  );
}
