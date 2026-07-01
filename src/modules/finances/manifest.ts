import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'finances',
  name: 'Finances',
  slug: 'finances',
  description: 'Net worth, accounts, spending, burn, and runway.',
  phaseId: 'phase_0',
  route: '/modules/finances',
  icon: 'wallet',
  capabilities: ['metrics', 'actions', 'decisions'],
  priority: 15,
};
