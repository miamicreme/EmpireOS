import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'acquisitions',
  name: 'Acquisitions',
  slug: 'acquisitions',
  description: 'Research, track, and close business acquisition targets.',
  phaseId: 'phase_2',
  route: '/modules/acquisitions',
  icon: 'building',
  capabilities: ['metrics', 'actions', 'decisions', 'events', 'health_check', 'sync'],
  priority: 60,
};
