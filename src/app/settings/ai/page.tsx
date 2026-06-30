import { PageHeader } from '@/components/ui/PageHeader';
import { ProviderManager } from '@/components/ui/ai/ProviderManager';

export const dynamic = 'force-dynamic';

export default function AiProvidersSettingsPage() {
  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="AI Providers"
        subtitle="Configure up to 5 LLMs. Keys are encrypted server-side and never leave it."
      />
      <div className="max-w-3xl">
        <ProviderManager />
      </div>
    </main>
  );
}
