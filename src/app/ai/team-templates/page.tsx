import { PageHeader } from '@/components/ui/PageHeader';
import { AiTeamsWorkbench } from '@/components/ai/teams/AiTeamsWorkbench';

export const dynamic = 'force-dynamic';

export default function AiTeamTemplatesPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="AI Team Templates"
        subtitle="Reusable team blueprints. Create a mission from a template to wake up the right AI team."
      />
      <AiTeamsWorkbench view="templates" />
    </main>
  );
}
