import { PageHeader } from '@/components/ui/PageHeader';
import { CallAssistPanel } from '@/components/call-command/CallAssistPanel';

export default function CallCommandPage() {
  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Call Assist"
        subtitle="Real-time call assistant. Paste what the prospect just said and get an instant, structured suggestion — nothing is recorded or saved."
      />
      <div className="max-w-5xl">
        <CallAssistPanel />
      </div>
    </main>
  );
}
