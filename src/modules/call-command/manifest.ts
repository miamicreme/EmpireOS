import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'call-command',
  name: 'Call Assist',
  slug: 'call-command',
  description:
    'Real-time call assistant: detects intent and stage from live conversation input and suggests a structured, spoken-language response.',
  phaseId: 'phase_1',
  route: '/call-command',
  icon: 'phone',
  capabilities: ['ai_context'],
  priority: 65,
};
