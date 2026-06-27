import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { getTodayMetrics, recordMetric } from '@/spine/metrics/metric.service';
import type { CreateModuleMetricInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

/** GET today's metrics. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);
  return jsonResult(await getTodayMetrics(supabase, auth.data));
}

/** POST record a metric. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateModuleMetricInput;
  return jsonResult(await recordMetric(supabase, auth.data, body), 201);
}
