/** Event types re-exported for module-local imports. */
export type { SystemEvent, EventType } from '../types';

/** Canonical event names emitted across the system. */
export const SYSTEM_EVENT_NAMES = [
  'cash.entry.created',
  'job.application.created',
  'contact.followup.due',
  'decision.finalized',
  'action.completed',
  'module.synced',
] as const;

export type SystemEventName = (typeof SYSTEM_EVENT_NAMES)[number] | (string & {});
