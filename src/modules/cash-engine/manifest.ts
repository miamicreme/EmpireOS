import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'cash-engine',
  name: 'Cash Engine',
  slug: 'cash-engine',
  description: 'Track and grow short-term cash flow.',
  phaseId: 'phase_0',
  route: '/modules/cash-engine',
  icon: 'banknote',
  capabilities: ['metrics', 'actions', 'decisions'],
  priority: 10,
};
