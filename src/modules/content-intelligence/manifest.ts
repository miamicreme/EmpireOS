import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'content-intelligence',
  name: 'Content Intelligence',
  slug: 'content-intelligence',
  description: 'Creates, governs, publishes, and learns from authority-building content.',
  phaseId: 'phase_1',
  route: '/modules/content-intelligence',
  icon: 'sparkles',
  capabilities: ['metrics', 'actions', 'decisions', 'events', 'ai_context', 'health_check', 'sync'],
  priority: 35,
};
