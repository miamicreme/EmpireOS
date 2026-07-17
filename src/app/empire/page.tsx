import { EmpireVoiceConsole } from '@/components/empire/EmpireVoiceConsole';
import { EmpireIntelligenceBenchmark } from '@/components/empire/EmpireIntelligenceBenchmark';

export default function EmpirePage() {
  return (
    <main className="min-h-screen bg-surface-0 px-4 py-20 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <EmpireVoiceConsole />
        <EmpireIntelligenceBenchmark />
      </div>
    </main>
  );
}
