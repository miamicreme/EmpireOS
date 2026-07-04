import { PageHeader } from '@/components/ui/PageHeader';
import { SecurityStatusWorkbench } from '@/components/ai/security/SecurityStatusWorkbench';

export const dynamic = 'force-dynamic';

export default function SecuritySettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Security"
        subtitle="Owner-only security posture, passkey count, recovery code state, and redaction status."
      />
      <SecurityStatusWorkbench />
    </main>
  );
}

