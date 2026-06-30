import { PageHeader } from '@/components/ui/PageHeader';
import { AgentConsole } from '@/components/ui/agent/AgentConsole';

export const dynamic = 'force-dynamic';

export default function AgentPage() {
  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="Agent"
        subtitle="One command. The agent reads your Spine, reasons, and drafts actions for approval."
      />
      <div className="max-w-3xl">
        <AgentConsole />
      </div>
    </main>
  );
}
