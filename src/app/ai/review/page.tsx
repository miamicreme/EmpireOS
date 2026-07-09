import { PageHeader } from '@/components/ui/PageHeader';
import { AiReviewQueue } from '@/components/ai/teams/AiReviewQueue';

export const dynamic = 'force-dynamic';

export default function AiReviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="AI Review Queue"
        subtitle="Mission review packages, approval gates, and controlled handoff before the Spine changes."
      />
      <AiReviewQueue />
    </main>
  );
}
