import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'job-hunt',
  name: 'High-Income Job Hunt',
  slug: 'job-hunt',
  description: 'Manage high-income job applications and pipeline.',
  phaseId: 'phase_1',
  route: '/modules/job-hunt',
  icon: 'briefcase',
  capabilities: ['metrics', 'actions', 'decisions'],
  priority: 20,
};
