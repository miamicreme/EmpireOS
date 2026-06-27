import type { ModuleManifest } from '@/spine/types';

/**
 * Template manifest. Copy this folder to create a new module, then update the
 * id/slug/route and wire the service to real tables.
 */
export const manifest: ModuleManifest = {
  id: 'template',
  name: 'Template Module',
  slug: 'template',
  description: 'Copy this module to bootstrap a new domain.',
  phaseId: 'phase_0',
  route: '/modules/template',
  icon: 'puzzle',
  capabilities: ['metrics', 'actions'],
  priority: 999,
};
