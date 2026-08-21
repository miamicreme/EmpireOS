import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'voice',
  name: 'Empire Voice',
  slug: 'voice',
  description:
    'Speak naturally to Empire through a governed voice layer with private audio handling, interruption, approvals, and verified backend execution.',
  phaseId: 'phase_1',
  route: '/voice',
  icon: 'mic-2',
  capabilities: ['metrics', 'actions', 'decisions'],
  priority: 75,
};
