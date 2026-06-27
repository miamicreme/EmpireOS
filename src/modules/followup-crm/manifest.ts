import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'followup-crm',
  name: 'Follow-Up CRM',
  slug: 'followup-crm',
  description: 'Track contacts and follow-ups so nothing slips.',
  phaseId: 'phase_1',
  route: '/modules/followup-crm',
  icon: 'users',
  capabilities: ['metrics', 'actions', 'decisions'],
  priority: 30,
};
