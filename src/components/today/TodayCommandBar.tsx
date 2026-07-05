'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import type { AgentRunOutput } from '@/spine/ai/agent/agent.types';

export function TodayCommandBar({ defaultCommand }: { defaultCommand: string }) {
  const router = useRouter();
  const [command, setCommand] = useState(defaultCommand);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(goDeeper = false) {
    setMessage(null);
    startTransition(async () => {
      const result = await api.post<AgentRunOutput>('/api/ai/agent/run', {
        command,
        modeHint: 'today_command_center',
        artifactTypeHint: 'daily_brief',
        runtimePreference: goDeeper ? 'deep' : 'standard',
        goDeeper,
      });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setMessage(result.data.actionDrafts.length > 0 ? 'AI brief updated. Drafts are waiting for approval.' : 'AI brief updated.');
      router.refresh();
    });
  }

  return (
    <div className="rounded-[18px] border border-empire-blue/30 bg-[radial-gradient(circle_at_top_left,rgba(201,166,89,0.12),transparent_42%),linear-gradient(135deg,rgb(var(--surface-2)),rgb(var(--surface-0)))] p-3 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface-0 px-4 text-sm text-gray-100 outline-none transition focus:border-empire-blue"
          aria-label="AI command"
        />
        <div className="flex gap-2">
          <Button type="button" onClick={() => run(false)} loading={isPending} className="flex-1 sm:flex-none">
            Run AI
          </Button>
          <Button type="button" variant="secondary" onClick={() => run(true)} loading={isPending} className="flex-1 sm:flex-none">
            Go Deeper
          </Button>
        </div>
      </div>
      {message && <p className="mt-2 text-xs font-mono text-empire-muted">{message}</p>}
    </div>
  );
}
