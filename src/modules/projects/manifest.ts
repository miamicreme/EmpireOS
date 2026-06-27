import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'projects',
  name: 'Projects',
  slug: 'projects',
  description: 'Manage active projects and prevent distraction.',
  phaseId: 'phase_1',
  route: '/modules/projects',
  icon: 'folder',
  capabilities: ['metrics', 'actions', 'decisions', 'events', 'health_check', 'sync'],
  priority: 50,
};
