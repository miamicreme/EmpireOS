import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
  recommendation?: string;
  severity: 'low' | 'medium' | 'high';
}

interface DoctorResult {
  checks: HealthCheck[];
  overallHealth: 'green' | 'yellow' | 'red';
  summary: {
    passing: number;
    warnings: number;
    failures: number;
  };
  timestamp: string;
}

async function checkTable(supabase: ReturnType<typeof createAdminClient>, tableName: string, isCritical = false): Promise<HealthCheck> {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        name: `Table: ${tableName}`,
        status: 'error',
        message: `Table does not exist or is inaccessible`,
        details: error.message,
        recommendation: isCritical
          ? `Run migration 0022_recorder_module or equivalent. See RECORDER_SETUP.md for details.`
          : `Check that the table exists and migration has been applied.`,
        severity: isCritical ? 'high' : 'medium',
      };
    }

    return {
      name: `Table: ${tableName}`,
      status: 'ok',
      message: `Table exists and accessible`,
      severity: 'low',
    };
  } catch (err) {
    return {
      name: `Table: ${tableName}`,
      status: 'error',
      message: 'Failed to check table',
      details: String(err),
      severity: isCritical ? 'high' : 'medium',
    };
  }
}

async function checkStorageBucket(supabase: ReturnType<typeof createAdminClient>, bucketName: string, isCritical = false): Promise<HealthCheck> {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);

    if (error || !data) {
      return {
        name: `Storage bucket: ${bucketName}`,
        status: 'error',
        message: 'Bucket does not exist',
        details: error?.message,
        recommendation: isCritical
          ? `Create the storage bucket via Supabase dashboard or migration. Check RECORDER_SETUP.md`
          : `Verify the bucket exists in Supabase Storage.`,
        severity: isCritical ? 'high' : 'medium',
      };
    }

    const visibilityStatus = data.public ? '(public)' : '(private)';
    return {
      name: `Storage bucket: ${bucketName}`,
      status: 'ok',
      message: `Bucket exists ${visibilityStatus}`,
      severity: 'low',
    };
  } catch (err) {
    return {
      name: `Storage bucket: ${bucketName}`,
      status: 'error',
      message: 'Failed to check bucket',
      details: String(err),
      severity: isCritical ? 'high' : 'medium',
    };
  }
}

async function checkEnvironmentVariables(): Promise<HealthCheck[]> {
  const required = [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', critical: true },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', critical: true },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', critical: true },
  ];

  return required.map((env) => ({
    name: `Environment: ${env.name}`,
    status: process.env[env.name] ? 'ok' : 'error',
    message: process.env[env.name] ? 'Configured' : 'Missing',
    recommendation: process.env[env.name]
      ? undefined
      : `Set ${env.name} in your .env.local or deployment environment variables.`,
    severity: env.critical ? 'high' : 'medium',
  }));
}

/** GET /api/health/doctor — comprehensive system health check. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const checks: HealthCheck[] = [];

  // Environment variables first — table/bucket checks below depend on the
  // service-role key being present, so surface a missing key as its own
  // actionable check rather than letting every infra check fail opaquely.
  checks.push(...await checkEnvironmentVariables());

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY missing — already reported above.
  }

  if (admin) {
    // Table/bucket checks use the service-role client (bypasses RLS) so
    // "does this exist" isn't confused with "can this user see rows in it".
    const criticalTables = ['recordings', 'global_actions', 'ai_providers', 'modules'];
    const optionalTables = ['webauthn_credentials', 'ai_provider_secrets'];

    for (const table of criticalTables) {
      checks.push(await checkTable(admin, table, true));
    }
    for (const table of optionalTables) {
      checks.push(await checkTable(admin, table, false));
    }

    const buckets = ['recordings'];
    for (const bucket of buckets) {
      checks.push(await checkStorageBucket(admin, bucket, true));
    }
  }

  // Determine overall health
  const errors = checks.filter(c => c.status === 'error').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const passing = checks.filter(c => c.status === 'ok').length;

  const overallHealth = errors > 0 ? 'red' : warnings > 0 ? 'yellow' : 'green';

  const result: DoctorResult = {
    checks,
    overallHealth,
    summary: {
      passing,
      warnings,
      failures: errors,
    },
    timestamp: new Date().toISOString(),
  };

  return jsonOk(result);
}
