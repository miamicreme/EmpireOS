import { PageHeader } from '@/components/ui/PageHeader';
import { ProvidersWorkbench } from '@/components/ai/providers/ProvidersWorkbench';

export const dynamic = 'force-dynamic';

export default function AiProvidersPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="AI Providers"
        subtitle="Configured provider state, health, and live connectivity checks without exposing API keys."
      />
      <ProvidersWorkbench />
    </main>
  );
}

