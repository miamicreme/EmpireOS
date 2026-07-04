import type { ModuleHealthResult } from '@/spine/types';
import { MODULE_IDS } from '@/spine/constants';

const MODULE_LABELS: Record<string, string> = {
  'cash-engine': 'Cash Engine',
  'job-hunt': 'Job Hunt',
  'followup-crm': 'Follow-up CRM',
  'credit-funding': 'Credit & Funding',
  'projects': 'Projects',
  'acquisitions': 'Acquisitions',
};

const MODULE_ICONS: Record<string, string> = {
  'cash-engine': '$',
  'job-hunt': '↗',
  'followup-crm': '◎',
  'credit-funding': '▲',
  'projects': '◻',
  'acquisitions': '◆',
};

function HealthDot({ health }: { health: string }) {
  const color =
    health === 'green'
      ? 'bg-empire-green'
      : health === 'yellow'
      ? 'bg-empire-yellow'
      : 'bg-empire-red';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export function ModuleHealthGrid({
  healthMap,
}: {
  healthMap: Partial<Record<string, ModuleHealthResult>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {MODULE_IDS.map((id) => {
        const result = healthMap[id];
        const health = result?.health ?? 'red';
        return (
          <div
            key={id}
            className="bg-surface-1 border border-border rounded-[14px] px-4 py-3 flex items-start gap-3 shadow-card"
          >
            <span className="text-empire-muted font-mono text-sm mt-0.5 w-4 shrink-0">
              {MODULE_ICONS[id]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-200 truncate">{MODULE_LABELS[id]}</span>
                <HealthDot health={health} />
              </div>
              <p className="text-xs text-empire-muted mt-0.5 truncate">
                {result?.reason ?? 'No data'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
