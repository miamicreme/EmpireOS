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
        status: isCritical ? 'error' : 'warning',
        message: `Table does not exist or is inaccessible`,
        details: error.message,
        recommendation: isCritical
          ? `Run migration 0022_recorder_module or equivalent. See RECORDER_SETUP.md for details.`
          : `Optional feature table — apply its migration if you want this feature enabled.`,
        severity: isCritical ? 'high' : 'low',
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
      status: isCritical ? 'error' : 'warning',
      message: 'Failed to check table',
      details: String(err),
      severity: isCritical ? 'high' : 'low',
    };
  }
}

async function checkStorageBucket(
  supabase: ReturnType<typeof createAdminClient>,
  bucketName: string,
  isCritical = false,
  expectPrivate = false,
): Promise<HealthCheck> {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);

    if (error || !data) {
      return {
        name: `Storage bucket: ${bucketName}`,
        status: isCritical ? 'error' : 'warning',
        message: 'Bucket does not exist',
        details: error?.message,
        recommendation: isCritical
          ? `Create the storage bucket via Supabase dashboard or migration. Check RECORDER_SETUP.md`
          : `Verify the bucket exists in Supabase Storage.`,
        severity: isCritical ? 'high' : 'low',
      };
    }

    if (expectPrivate && data.public) {
      return {
        name: `Storage bucket: ${bucketName}`,
        status: 'error',
        message: 'Bucket is public — expected private',
        details: 'Objects in this bucket are reachable via public Supabase Storage URLs with no auth check.',
        recommendation: `Set the bucket to private (public = false) in Supabase Storage settings. Access should only go through short-lived signed URLs minted server-side.`,
        severity: 'high',
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
      status: isCritical ? 'error' : 'warning',
      message: 'Failed to check bucket',
      details: String(err),
      severity: isCritical ? 'high' : 'low',
    };
  }
}

function summarize(checks: HealthCheck[]): DoctorResult {
  const failures = checks.filter((c) => c.status === 'error').length;
  const warnings = checks.filter((c) => c.status === 'warning').length;
  const passing = checks.filter((c) => c.status === 'ok').length;
  return {
    checks,
    overallHealth: failures > 0 ? 'red' : warnings > 0 ? 'yellow' : 'green',
    summary: { passing, warnings, failures },
    timestamp: new Date().toISOString(),
  };
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Supabase anon/service-role keys are JWTs (three dot-separated segments). */
function looksLikeSupabaseKey(value: string): boolean {
  return value.split('.').length === 3;
}

const ENV_SHAPE_VALIDATORS: Record<string, (value: string) => boolean> = {
  NEXT_PUBLIC_SUPABASE_URL: isValidUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: looksLikeSupabaseKey,
  SUPABASE_SERVICE_ROLE_KEY: looksLikeSupabaseKey,
};

async function checkEnvironmentVariables(): Promise<HealthCheck[]> {
  const required = [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', critical: true },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', critical: true },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', critical: true },
  ];

  return required.map((env) => {
    const value = process.env[env.name];
    if (!value) {
      return {
        name: `Environment: ${env.name}`,
        status: 'error' as const,
        message: 'Missing',
        recommendation: `Set ${env.name} in your .env.local or deployment environment variables.`,
        severity: env.critical ? 'high' as const : 'medium' as const,
      };
    }

    const shapeOk = ENV_SHAPE_VALIDATORS[env.name]?.(value) ?? true;
    if (!shapeOk) {
      return {
        name: `Environment: ${env.name}`,
        status: 'error' as const,
        message: 'Set, but malformed',
        details: env.name === 'NEXT_PUBLIC_SUPABASE_URL'
          ? `"${value}" is not a valid URL.`
          : 'Does not look like a Supabase JWT key (expected three dot-separated segments).',
        recommendation: `Double-check the value of ${env.name} — it's set but doesn't look right, which will break Supabase client construction.`,
        severity: env.critical ? 'high' as const : 'medium' as const,
      };
    }

    return {
      name: `Environment: ${env.name}`,
      status: 'ok' as const,
      message: 'Configured',
      severity: env.critical ? 'high' as const : 'medium' as const,
    };
  });
}

/** GET /api/health/doctor — comprehensive system health check. */
export async function GET() {
  const checks: HealthCheck[] = [];

  // Environment variables first, and before constructing any Supabase
  // client: a missing/malformed NEXT_PUBLIC_SUPABASE_URL or ANON_KEY makes
  // createClient() below throw synchronously, which is exactly the
  // misconfiguration this endpoint exists to diagnose. Surfacing it here
  // means a broken deployment still gets a real answer instead of a bare 500.
  checks.push(...await checkEnvironmentVariables());

  try {
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return jsonError(auth.error);
  } catch {
    // Client construction itself failed (bad URL/key) — env checks above
    // already flagged it. Nothing further can be verified without a working
    // Supabase connection, so return what we have instead of crashing.
    return jsonOk(summarize(checks));
  }

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY missing — already reported above.
  }

  if (admin) {
    // Table/bucket checks use the service-role client (bypasses RLS) so
    // "does this exist" isn't confused with "can this user see rows in it".
    const criticalTables = ['recordings', 'global_actions', 'ai_providers', 'modules', 'empire_documents'];
    const optionalTables = [
      'webauthn_credentials',
      'ai_provider_secrets',
      'empire_document_extractions',
      'empire_document_analyses',
      'empire_document_routes',
      'empire_document_links',
    ];

    for (const table of criticalTables) {
      checks.push(await checkTable(admin, table, true));
    }
    for (const table of optionalTables) {
      checks.push(await checkTable(admin, table, false));
    }

    const buckets = [
      { name: 'recordings', expectPrivate: true },
      { name: 'empire-documents', expectPrivate: true },
    ];
    for (const bucket of buckets) {
      checks.push(await checkStorageBucket(admin, bucket.name, true, bucket.expectPrivate));
    }
  }

  return jsonOk(summarize(checks));
}
