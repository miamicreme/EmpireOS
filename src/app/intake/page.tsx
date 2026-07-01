import { PageHeader } from '@/components/ui/PageHeader';
import { IntakeConsole } from '@/components/ui/ai/IntakeConsole';

export const dynamic = 'force-dynamic';

export default function IntakePage() {
  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="Intake"
        subtitle="Submit a document — the agent reviews it, files it to the right module, and drafts the work."
      />
      <IntakeConsole />
    </main>
  );
}
