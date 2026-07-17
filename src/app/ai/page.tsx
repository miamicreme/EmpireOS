import { redirect } from 'next/navigation';

/**
 * Empire is the single owner-facing conversational intelligence surface.
 * Advanced AI capability pages remain available at their direct routes, but
 * the former AI hub no longer competes with Empire as a second command center.
 */
export default function AiHubPage() {
  redirect('/empire');
}
