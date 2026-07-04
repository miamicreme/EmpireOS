import { PageHeader } from '@/components/ui/PageHeader';
import { PasskeyEnrollmentWorkbench } from '@/components/auth/PasskeyEnrollmentWorkbench';

export const dynamic = 'force-dynamic';

export default function PasskeyEnrollmentPage({ params }: { params: { token: string } }) {
  const { token } = params;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Add another device"
        subtitle="Use this link on your iPhone or other device without removing the passkey already on your Windows PC."
      />
      <PasskeyEnrollmentWorkbench token={token} />
    </main>
  );
}
