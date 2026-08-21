import type { ModuleManifest } from '@/spine/types';

export const manifest: ModuleManifest = {
  id: 'job-hunt',
  name: 'Career Command',
  slug: 'job-hunt',
  description: 'High-income career pipeline with fit scoring, drafter-reviewer application workflow, interview prep, and offer decision support.',
  phaseId: 'phase_1',
  route: '/modules/job-hunt',
  icon: 'briefcase',
  capabilities: ['metrics', 'actions', 'decisions', 'fit-scoring', 'interview-prep', 'application-review'],
  priority: 20,
};
