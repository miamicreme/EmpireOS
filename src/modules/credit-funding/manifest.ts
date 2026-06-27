import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'credit-funding',
  name: 'Credit & Funding',
  slug: 'credit-funding',
  description: 'Track credit scores, disputes, and funding readiness.',
  phaseId: 'phase_0',
  route: '/modules/credit-funding',
  icon: 'credit-card',
  capabilities: ['metrics', 'actions', 'decisions', 'events', 'health_check', 'sync'],
  priority: 40,
};
