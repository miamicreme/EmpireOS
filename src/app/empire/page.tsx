import { EmpireVoiceConsole } from '@/components/empire/EmpireVoiceConsole';
import { EmpireIntelligenceBenchmark } from '@/components/empire/EmpireIntelligenceBenchmark';

export default function EmpirePage() {
  return (
    <main className="min-h-screen bg-surface-0 px-4 py-20 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <EmpireVoiceConsole />
        <details className="rounded-2xl border border-border bg-surface-1 shadow-card">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-200">
            Intelligence diagnostics
          </summary>
          <div className="border-t border-border p-4">
            <EmpireIntelligenceBenchmark />
          </div>
        </details>
      </div>
    </main>
  );
}
