import { PageHeader } from '@/components/ui/PageHeader';
import { AiDecisionConsole } from '@/components/ui/ai/AiDecisionConsole';

export const dynamic = 'force-dynamic';

export default function AiDecisionsPage() {
  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="AI Decision Console"
        subtitle="Ask a decision; the AI returns a recommendation and draftable actions"
      />
      <div className="max-w-3xl">
        <AiDecisionConsole />
      </div>
    </main>
  );
}
