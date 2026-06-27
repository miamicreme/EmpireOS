import { jsonOk } from '@/lib/api';
import { getActiveModules } from '@/spine/module-registry';

export const dynamic = 'force-dynamic';

/** GET module registry metadata (manifests only — no user data). */
export async function GET() {
  const modules = getActiveModules().map((m) => m.manifest);
  return jsonOk(modules);
}
