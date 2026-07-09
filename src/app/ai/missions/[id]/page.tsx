import { PageHeader } from '@/components/ui/PageHeader';
import { AiMissionDetailWorkbench } from '@/components/ai/teams/AiMissionDetailWorkbench';

export const dynamic = 'force-dynamic';

export default function AiMissionDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="AI Mission"
        subtitle="Mission objective, team, tasks, review package, and approval-gated status transitions."
      />
      <AiMissionDetailWorkbench missionId={params.id} />
    </main>
  );
}
