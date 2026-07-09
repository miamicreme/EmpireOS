import { PageHeader } from '@/components/ui/PageHeader';
import { AiTeamsWorkbench } from '@/components/ai/teams/AiTeamsWorkbench';

export const dynamic = 'force-dynamic';

export default function AiTeamsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="AI Teams"
        subtitle="Active execution squads, team members, and their controlled mission work."
      />
      <AiTeamsWorkbench view="teams" />
    </main>
  );
}
