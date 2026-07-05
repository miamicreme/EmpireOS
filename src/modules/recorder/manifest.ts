import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'recorder',
  name: 'Empire Recorder',
  slug: 'recorder',
  description:
    'Record interviews and conversations, then transcribe, translate, and turn them into notes and action drafts.',
  phaseId: 'phase_1',
  route: '/recorder',
  icon: 'mic',
  capabilities: ['metrics', 'actions', 'decisions'],
  priority: 70,
};
