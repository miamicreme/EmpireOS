import { PageHeader } from '@/components/ui/PageHeader';
import { AiTeamsWorkbench } from '@/components/ai/teams/AiTeamsWorkbench';

export const dynamic = 'force-dynamic';

export default function AiOrgPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="AI Organization"
        subtitle="The full EmpireOS AI company chart: templates, groups, active teams, and mission load."
      />
      <AiTeamsWorkbench view="org" />
    </main>
  );
}
