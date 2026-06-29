import { PageHeader } from '@/components/ui/PageHeader';
import { AiChat } from '@/components/ui/ai/AiChat';

export const dynamic = 'force-dynamic';

export default function AiChatPage() {
  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader title="Ask Empire OS" subtitle="Free-form conversation with your Chief of Staff" />
      <div className="max-w-3xl">
        <AiChat />
      </div>
    </main>
  );
}
